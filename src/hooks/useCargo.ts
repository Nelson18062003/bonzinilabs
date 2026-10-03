import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { validateUploadFile } from '@/lib/utils';
import { shouldPollLookup } from '@/lib/cargo/lookup';
import type { CargoCost, CargoDocument, CargoEvent, CargoLookup, CargoPackage, CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';
import type { CargoDocFolder } from '@/lib/cargo/documents';
import type { CargoParty, CargoShipmentPartyWithParty } from '@/lib/cargo/parties';

// ⚠ Module ADMIN : tout passe par supabaseAdmin (voir .claude/rules/supabase-clients.md).

/** Le stockage privé des fichiers cargo (pièces du classeur, justificatifs de coûts). */
const BUCKET = 'cargo-documents';

type RpcResult = { success?: boolean; error?: string; [k: string]: unknown } | null;
function assertOk(data: unknown): Record<string, unknown> {
  const r = data as RpcResult;
  if (r && r.success === false) throw new Error(r.error ?? 'Refus');
  return (r ?? {}) as Record<string, unknown>;
}

/* ── Flotte ─────────────────────────────────────────────────────────────── */

export function useCargoShipments(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['cargo', 'shipments'],
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('cargo_shipments')
        .select('*')
        .order('eta_carrier', { ascending: true, nullsFirst: false })
        .order('eta_promised', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CargoShipment[];
    },
    staleTime: 30_000,
  });
}

export function useCargoShipment(id: string | null) {
  return useQuery({
    queryKey: ['cargo', 'shipment', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.from('cargo_shipments').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return (data ?? null) as CargoShipment | null;
    },
    staleTime: 30_000,
  });
}

export function useCargoVesselPositions() {
  return useQuery({
    queryKey: ['cargo', 'positions'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.from('cargo_vessel_positions').select('*');
      if (error) throw error;
      return (data ?? []) as CargoVesselPosition[];
    },
    staleTime: 30_000,
  });
}

export function useCargoEvents(shipmentId: string | null) {
  return useQuery({
    queryKey: ['cargo', 'events', shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('cargo_events')
        .select('*')
        .eq('shipment_id', shipmentId!)
        .order('event_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CargoEvent[];
    },
    staleTime: 30_000,
  });
}

/** Les champs que l'admin édite à la main (RLS : canManageCargo). */
export type CargoShipmentPatch = Partial<
  Pick<
    CargoShipment,
    | 'freight_paid' | 'telex_released' | 'notes' | 'client_label' | 'client_id' | 'freight_usd'
    | 'eta_promised' | 'etd_promised' | 'vessel_name' | 'vessel_imo' | 'vessel_mmsi' | 'voyage'
    | 'eta_carrier' | 'status' | 'arrival_notice_at' | 'free_time_ends_on' | 'customs_declaration_ref'
    | 'customs_cleared_at' | 'delivery_order_at' | 'gate_out_at' | 'empty_returned_at' | 'besc_number'
    | 'goods_description' | 'gross_weight_kg' | 'packages_count' | 'freight_note'
  >
>;

export function useUpdateCargoShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CargoShipmentPatch }) => {
      const { error } = await supabaseAdmin.from('cargo_shipments').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cargo'] }),
    onError: (e: Error) => toast.error(`Modification impossible : ${e.message}`),
  });
}

export function useRemoveCargoShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabaseAdmin.rpc('remove_cargo_shipment', { p_id: id });
      if (error) throw error;
      assertOk(data);
    },
    onSuccess: () => {
      toast.success('Conteneur retiré de la flotte');
      qc.invalidateQueries({ queryKey: ['cargo'] });
    },
    onError: (e: Error) => toast.error(`Retrait impossible : ${e.message}`),
  });
}

/**
 * Bouton « Rafraîchir » : la RPC déclenche l'edge function via pg_net (on ne
 * peut pas l'invoquer depuis le front, cf. règle supabase-clients). La
 * synchronisation prend quelques secondes : on relit les données après.
 */
export function useRequestCargoSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabaseAdmin.rpc('request_cargo_sync');
      if (error) throw error;
      assertOk(data);
    },
    onSuccess: () => {
      toast.success('Mise à jour lancée — les jalons arrivent dans quelques secondes');
      window.setTimeout(() => qc.invalidateQueries({ queryKey: ['cargo'] }), 8_000);
      window.setTimeout(() => qc.invalidateQueries({ queryKey: ['cargo'] }), 25_000);
    },
    onError: (e: Error) => toast.error(`Mise à jour impossible : ${e.message}`),
  });
}

/* ── Suivre une référence ───────────────────────────────────────────────── */

export function useRequestCargoLookup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reference: string) => {
      const { data, error } = await supabaseAdmin.rpc('request_cargo_lookup', { p_reference: reference });
      if (error) throw error;
      const r = assertOk(data);
      return r.lookup_id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cargo', 'lookups'] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Sonde la recherche toutes les 1,5 s tant qu'elle est en cours — mais PAS
 * indéfiniment. `net.http_post` est un tir sans retour : si l'edge function
 * n'est pas déployée, la ligne reste `pending` pour toujours et on sonderait
 * jusqu'à la fermeture de l'onglet. Voir src/lib/cargo/lookup.ts.
 */
export function useCargoLookup(lookupId: string | null) {
  return useQuery({
    queryKey: ['cargo', 'lookup', lookupId],
    enabled: !!lookupId,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.from('cargo_lookups').select('*').eq('id', lookupId!).single();
      if (error) throw error;
      return data as CargoLookup;
    },
    refetchInterval: (q) => (shouldPollLookup(q.state.data) ? 1_500 : false),
  });
}

export function useRecentCargoLookups() {
  return useQuery({
    queryKey: ['cargo', 'lookups'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('cargo_lookups')
        .select('id, reference, reference_type, carrier, status, created_at, completed_at, error, result, requested_by')
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as CargoLookup[];
    },
    staleTime: 15_000,
  });
}

export interface AddShipmentInput {
  lookupId: string;
  containerNumber: string;
  clientLabel: string;
  freightUsd: number | null;
  etaPromised: string | null;
  etdPromised: string | null;
}

export function useAddCargoShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddShipmentInput) => {
      const { data, error } = await supabaseAdmin.rpc('add_cargo_shipment', {
        p_lookup_id: input.lookupId,
        p_container_number: input.containerNumber,
        p_client_label: input.clientLabel,
        p_freight_usd: input.freightUsd ?? undefined,
        p_eta_promised: input.etaPromised ?? undefined,
        p_etd_promised: input.etdPromised ?? undefined,
      });
      if (error) throw error;
      return assertOk(data).shipment_id as string;
    },
    onSuccess: () => {
      toast.success('Conteneur ajouté à la flotte');
      qc.invalidateQueries({ queryKey: ['cargo'] });
    },
    onError: (e: Error) => toast.error(`Ajout impossible : ${e.message}`),
  });
}

export interface ManualShipmentInput {
  clientLabel: string; carrier: string; blNumber: string; containerNumber: string;
  podName: string; podUnlocode: string | null; polName: string | null; polUnlocode: string | null;
  etdPromised: string | null; etaPromised: string | null; freightUsd: number | null;
  vesselName: string | null; vesselImo: string | null; vesselMmsi: string | null; voyage: string | null;
}

/** Ajouter un conteneur sans suivi armateur (CMA CGM en attendant l'API). */
export function useCreateCargoShipmentManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: ManualShipmentInput) => {
      const { data, error } = await supabaseAdmin.rpc('create_cargo_shipment_manual', {
        p_client_label: i.clientLabel, p_carrier: i.carrier, p_bl_number: i.blNumber, p_container_number: i.containerNumber,
        p_pod_name: i.podName, p_pod_unlocode: i.podUnlocode ?? undefined, p_pol_name: i.polName ?? undefined, p_pol_unlocode: i.polUnlocode ?? undefined,
        p_etd_promised: i.etdPromised ?? undefined, p_eta_promised: i.etaPromised ?? undefined, p_freight_usd: i.freightUsd ?? undefined,
        p_vessel_name: i.vesselName ?? undefined, p_vessel_imo: i.vesselImo ?? undefined, p_vessel_mmsi: i.vesselMmsi ?? undefined, p_voyage: i.voyage ?? undefined,
      });
      if (error) throw error;
      return assertOk(data).shipment_id as string;
    },
    onSuccess: () => {
      toast.success('Conteneur ajouté à la flotte');
      qc.invalidateQueries({ queryKey: ['cargo'] });
    },
    onError: (e: Error) => toast.error(`Ajout impossible : ${e.message}`),
  });
}

/* ── Coûts du dossier ───────────────────────────────────────────────────── */

export function useCargoCosts(shipmentId: string | null) {
  return useQuery({
    queryKey: ['cargo', 'costs', shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('cargo_costs')
        .select('*')
        .eq('shipment_id', shipmentId!)
        .order('incurred_on', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as CargoCost[];
    },
    staleTime: 30_000,
  });
}

export type CargoCostInput = Pick<CargoCost, 'kind' | 'amount' | 'currency'> &
  Partial<Pick<CargoCost, 'label' | 'incurred_on' | 'paid' | 'paid_on' | 'payee' | 'invoice_ref' | 'note'>>;

export function useAddCargoCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shipmentId, cost }: { shipmentId: string; cost: CargoCostInput }) => {
      const { data: auth } = await supabaseAdmin.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Session expirée');
      const { data, error } = await supabaseAdmin.from('cargo_costs').insert({ ...cost, shipment_id: shipmentId, created_by: uid }).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (_d, v) => {
      toast.success('Coût ajouté');
      qc.invalidateQueries({ queryKey: ['cargo', 'costs', v.shipmentId] });
    },
    onError: (e: Error) => toast.error(`Ajout impossible : ${e.message}`),
  });
}

export function useUpdateCargoCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CargoCost>; shipmentId: string }) => {
      const { error } = await supabaseAdmin.from('cargo_costs').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['cargo', 'costs', v.shipmentId] }),
    onError: (e: Error) => toast.error(`Modification impossible : ${e.message}`),
  });
}

/** Supprimer un coût ET ses justificatifs (fichiers compris) : un reçu sans coût n'a plus de sens. */
export function useDeleteCargoCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, files }: { id: string; shipmentId: string; files?: CargoDocument[] }) => {
      if (files?.length) {
        const { error: e1 } = await supabaseAdmin.from('cargo_documents').delete().in('id', files.map((f) => f.id));
        if (e1) throw e1;
        await supabaseAdmin.storage.from(BUCKET).remove(files.map((f) => f.storage_path));
      }
      const { error } = await supabaseAdmin.from('cargo_costs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success('Coût supprimé');
      qc.invalidateQueries({ queryKey: ['cargo', 'costs', v.shipmentId] });
      qc.invalidateQueries({ queryKey: ['cargo', 'documents'] });
    },
    onError: (e: Error) => toast.error(`Suppression impossible : ${e.message}`),
  });
}

/* ── Colis du conteneur (ce qu'il y a dedans) ───────────────────────────── */

export function useCargoPackages(shipmentId: string | null) {
  return useQuery({
    queryKey: ['cargo', 'packages', shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('cargo_packages')
        .select('*')
        .eq('shipment_id', shipmentId!)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CargoPackage[];
    },
    staleTime: 30_000,
  });
}

export type CargoPackageInput = Pick<CargoPackage, 'label' | 'kind' | 'qty' | 'length_cm' | 'width_cm' | 'height_cm'> &
  Partial<Pick<CargoPackage, 'weight_kg' | 'stackable' | 'supplier' | 'note' | 'position' | 'cbm' | 'owner_label' | 'client_id' | 'hs_code'>>;

export function useAddCargoPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shipmentId, pkg }: { shipmentId: string; pkg: CargoPackageInput }) => {
      const { data: auth } = await supabaseAdmin.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Session expirée');
      const { error } = await supabaseAdmin.from('cargo_packages').insert({ ...pkg, shipment_id: shipmentId, created_by: uid });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success('Colis ajouté');
      qc.invalidateQueries({ queryKey: ['cargo', 'packages', v.shipmentId] });
    },
    onError: (e: Error) => toast.error(`Ajout impossible : ${e.message}`),
  });
}

export function useUpdateCargoPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CargoPackage>; shipmentId: string }) => {
      const { error } = await supabaseAdmin.from('cargo_packages').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success('Lot modifié');
      qc.invalidateQueries({ queryKey: ['cargo', 'packages', v.shipmentId] });
    },
    onError: (e: Error) => toast.error(`Modification impossible : ${e.message}`),
  });
}

export function useDeleteCargoPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; shipmentId: string }) => {
      const { error } = await supabaseAdmin.from('cargo_packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['cargo', 'packages', v.shipmentId] }),
    onError: (e: Error) => toast.error(`Suppression impossible : ${e.message}`),
  });
}

/* ── Client Bonzini rattaché au dossier ─────────────────────────────────── */

export function useCargoClient(clientId: string | null) {
  return useQuery({
    queryKey: ['cargo', 'client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('id, first_name, last_name, company_name, phone, email, city, country, kyc_verified, customer_code')
        .eq('id', clientId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

/** Liste courte des clients, pour rattacher un dossier. */
export function useCargoClientOptions(search: string) {
  return useQuery({
    queryKey: ['cargo', 'client-options', search],
    queryFn: async () => {
      let q = supabaseAdmin.from('clients').select('id, first_name, last_name, company_name').limit(20);
      // `,` `(` `)` `%` `\` sont la grammaire du filtre PostgREST : tapés dans la
      // recherche, ils cassaient (ou réécrivaient) la requête. On les efface.
      const needle = search.replace(/[,()%\\]/g, ' ').trim();
      if (needle) q = q.or(`first_name.ilike.%${needle}%,last_name.ilike.%${needle}%,company_name.ilike.%${needle}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}

/* ── Parties prenantes ──────────────────────────────────────────────────── */

/** Qui fait quoi sur ce conteneur, avec la fiche de chaque partie. */
export function useCargoShipmentParties(shipmentId: string | null) {
  return useQuery({
    queryKey: ['cargo', 'shipment-parties', shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('cargo_shipment_parties')
        .select('*, party:cargo_parties(*)')
        .eq('shipment_id', shipmentId!)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CargoShipmentPartyWithParty[];
    },
    staleTime: 30_000,
  });
}

/** L'annuaire, pour choisir une partie déjà connue au lieu de la ressaisir. */
export function useCargoParties(search: string) {
  return useQuery({
    queryKey: ['cargo', 'parties', search],
    queryFn: async () => {
      let q = supabaseAdmin.from('cargo_parties').select('*').order('name', { ascending: true }).limit(40);
      const needle = search.replace(/[,()%\\]/g, ' ').trim();
      if (needle) q = q.or(`name.ilike.%${needle}%,contact_name.ilike.%${needle}%,city.ilike.%${needle}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CargoParty[];
    },
    staleTime: 30_000,
  });
}

export type CargoPartyInput = Pick<CargoParty, 'name'> &
  Partial<Pick<CargoParty, 'contact_name' | 'phone' | 'whatsapp' | 'email' | 'city' | 'country' | 'note'>>;

/**
 * Poser un rôle sur le conteneur. `partyId` = une partie de l'annuaire ;
 * sinon `party` crée la fiche d'abord.
 */
export function useAddShipmentParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shipmentId, role, note, partyId, party, position }: {
      shipmentId: string; role: string; note?: string | null; partyId?: string; party?: CargoPartyInput; position?: number;
    }) => {
      const { data: auth } = await supabaseAdmin.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Session expirée');
      let id = partyId;
      if (!id) {
        if (!party?.name?.trim()) throw new Error('Nom manquant');
        const { data, error } = await supabaseAdmin.from('cargo_parties').insert({ ...party, name: party.name.trim(), created_by: uid }).select('id').single();
        if (error) throw error;
        id = data.id;
      }
      const { error } = await supabaseAdmin.from('cargo_shipment_parties').insert({
        shipment_id: shipmentId, party_id: id, role, note: note?.trim() || null, position: position ?? 0, created_by: uid,
      });
      if (error) throw error.code === '23505' ? new Error('Cette partie tient déjà ce rôle sur ce conteneur') : error;
    },
    onSuccess: (_d, v) => {
      toast.success('Intervenant ajouté');
      qc.invalidateQueries({ queryKey: ['cargo', 'shipment-parties', v.shipmentId] });
      qc.invalidateQueries({ queryKey: ['cargo', 'parties'] });
    },
    onError: (e: Error) => toast.error(`Ajout impossible : ${e.message}`),
  });
}

/** Modifier la fiche d'une partie (elle change sur tous les conteneurs) et la note du rôle. */
export function useUpdateShipmentParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ link, party, note }: { link: CargoShipmentPartyWithParty; party?: Partial<CargoPartyInput>; note?: string | null }) => {
      if (party) {
        const { error } = await supabaseAdmin.from('cargo_parties').update(party).eq('id', link.party_id);
        if (error) throw error;
      }
      if (note !== undefined) {
        const { error } = await supabaseAdmin.from('cargo_shipment_parties').update({ note: note?.trim() || null }).eq('id', link.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Intervenant modifié');
      qc.invalidateQueries({ queryKey: ['cargo', 'shipment-parties'] });
      qc.invalidateQueries({ queryKey: ['cargo', 'parties'] });
    },
    onError: (e: Error) => toast.error(`Modification impossible : ${e.message}`),
  });
}

/** Retirer un rôle du conteneur. La fiche reste dans l'annuaire. */
export function useRemoveShipmentParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (link: CargoShipmentPartyWithParty) => {
      const { error } = await supabaseAdmin.from('cargo_shipment_parties').delete().eq('id', link.id);
      if (error) throw error;
    },
    onSuccess: (_d, link) => {
      toast.success('Intervenant retiré du conteneur');
      qc.invalidateQueries({ queryKey: ['cargo', 'shipment-parties', link.shipment_id] });
    },
    onError: (e: Error) => toast.error(`Retrait impossible : ${e.message}`),
  });
}

/* ── Documents ──────────────────────────────────────────────────────────── */


/**
 * Les pièces de TOUTE la flotte, groupées par conteneur — pour que la liste,
 * la carte et le dossier calculent le même « à faire » (sans elles, la liste
 * croyait le B/L manquant alors que le dossier le voyait classé).
 */
export function useCargoFleetDocuments(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['cargo', 'documents', 'fleet'],
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.from('cargo_documents').select('*').limit(3000);
      if (error) throw error;
      const by: Record<string, CargoDocument[]> = {};
      for (const d of (data ?? []) as CargoDocument[]) (by[d.shipment_id] ??= []).push(d);
      return by;
    },
    staleTime: 60_000,
  });
}

export function useCargoDocuments(shipmentId: string | null) {
  return useQuery({
    queryKey: ['cargo', 'documents', shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('cargo_documents')
        .select('*')
        .eq('shipment_id', shipmentId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CargoDocument[];
    },
    staleTime: 30_000,
  });
}

export interface UploadDocInput {
  shipmentId: string;
  /** Catégorie du fichier (celle de sa pièce). */
  kind: string;
  file: File;
  folderId?: string | null;
  costId?: string | null;
  title?: string | null;
}

/** Envoie UN fichier : stockage privé puis ligne cargo_documents (le fichier est retiré si la ligne échoue). */
async function uploadOne({ shipmentId, kind, file, folderId, costId, title }: UploadDocInput, uid: string) {
  validateUploadFile(file);
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
  const path = `${shipmentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabaseAdmin.from('cargo_documents').insert({
    shipment_id: shipmentId, kind, file_name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size,
    uploaded_by: uid, folder_id: folderId ?? null, cost_id: costId ?? null, title: title?.trim() || null,
  });
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export function useUploadCargoDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadDocInput) => {
      const { data: auth } = await supabaseAdmin.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Session expirée');
      await uploadOne(input, uid);
    },
    onSuccess: () => {
      toast.success('Document ajouté');
      qc.invalidateQueries({ queryKey: ['cargo', 'documents'] });
    },
    onError: (e: Error) => toast.error(`Ajout impossible : ${e.message}`),
  });
}

/**
 * Envoie PLUSIEURS fichiers à la suite, dans la même pièce. Un fichier refusé
 * (type, taille) n'arrête pas les autres : on dit lesquels sont passés.
 */
export function useUploadCargoDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ files, ...rest }: Omit<UploadDocInput, 'file'> & { files: File[] }) => {
      const { data: auth } = await supabaseAdmin.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Session expirée');
      const failed: string[] = [];
      let ok = 0;
      for (const file of files) {
        try {
          await uploadOne({ ...rest, file }, uid);
          ok += 1;
        } catch (e) {
          failed.push(`${file.name} : ${(e as Error).message}`);
        }
      }
      return { ok, failed };
    },
    onSuccess: ({ ok, failed }) => {
      if (ok > 0) toast.success(ok === 1 ? 'Fichier ajouté' : `${ok} fichiers ajoutés`);
      for (const f of failed) toast.error(f);
      qc.invalidateQueries({ queryKey: ['cargo', 'documents'] });
    },
    onError: (e: Error) => toast.error(`Envoi impossible : ${e.message}`),
  });
}

export type CargoDocumentPatch = Partial<Pick<CargoDocument, 'title' | 'note' | 'folder_id' | 'cost_id' | 'kind'>>;

/** Renommer, annoter, déplacer un fichier (le chemin et le dossier sont figés côté base). */
export function useUpdateCargoDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CargoDocumentPatch }) => {
      const { error } = await supabaseAdmin.from('cargo_documents').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cargo', 'documents'] }),
    onError: (e: Error) => toast.error(`Modification impossible : ${e.message}`),
  });
}

export function useDeleteCargoDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc: CargoDocument) => {
      const { error } = await supabaseAdmin.from('cargo_documents').delete().eq('id', doc.id);
      if (error) throw error;
      await supabaseAdmin.storage.from(BUCKET).remove([doc.storage_path]);
    },
    onSuccess: () => {
      toast.success('Fichier supprimé');
      qc.invalidateQueries({ queryKey: ['cargo', 'documents'] });
    },
    onError: (e: Error) => toast.error(`Suppression impossible : ${e.message}`),
  });
}

/* ── Pièces du classeur ─────────────────────────────────────────────────── */

export function useCargoDocFolders(shipmentId: string | null) {
  return useQuery({
    queryKey: ['cargo', 'doc-folders', shipmentId],
    enabled: !!shipmentId,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('cargo_doc_folders')
        .select('*')
        .eq('shipment_id', shipmentId!)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CargoDocFolder[];
    },
    staleTime: 30_000,
  });
}

export type CargoDocFolderInput = Pick<CargoDocFolder, 'title' | 'category'> & Partial<Pick<CargoDocFolder, 'note' | 'expected_count' | 'position'>>;

export function useCreateCargoDocFolders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ shipmentId, folders }: { shipmentId: string; folders: CargoDocFolderInput[] }) => {
      const { data: auth } = await supabaseAdmin.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Session expirée');
      const { error } = await supabaseAdmin
        .from('cargo_doc_folders')
        .insert(folders.map((f) => ({ ...f, title: f.title.trim(), shipment_id: shipmentId, created_by: uid })));
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.folders.length > 1 ? `${v.folders.length} pièces créées` : 'Pièce créée');
      qc.invalidateQueries({ queryKey: ['cargo', 'doc-folders', v.shipmentId] });
    },
    onError: (e: Error) => toast.error(`Création impossible : ${e.message}`),
  });
}

export function useUpdateCargoDocFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, files }: { id: string; shipmentId: string; patch: Partial<CargoDocFolderInput>; files?: CargoDocument[] }) => {
      const { error } = await supabaseAdmin.from('cargo_doc_folders').update(patch).eq('id', id);
      if (error) throw error;
      // La catégorie d'une pièce est celle de ses fichiers : la liste « à faire » lit les fichiers.
      if (patch.category && files?.length) {
        const { error: e2 } = await supabaseAdmin.from('cargo_documents').update({ kind: patch.category }).in('id', files.map((f) => f.id));
        if (e2) throw e2;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['cargo', 'doc-folders', v.shipmentId] });
      qc.invalidateQueries({ queryKey: ['cargo', 'documents'] });
    },
    onError: (e: Error) => toast.error(`Modification impossible : ${e.message}`),
  });
}

/**
 * Supprimer une pièce. `withFiles` : ses fichiers partent avec elle (stockage
 * compris) ; sinon ils restent, « non classés » (la base met folder_id à NULL).
 */
export function useDeleteCargoDocFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ folder, files, withFiles }: { folder: CargoDocFolder; files: CargoDocument[]; withFiles: boolean }) => {
      if (withFiles && files.length > 0) {
        const { error } = await supabaseAdmin.from('cargo_documents').delete().in('id', files.map((f) => f.id));
        if (error) throw error;
        await supabaseAdmin.storage.from(BUCKET).remove(files.map((f) => f.storage_path));
      }
      const { error } = await supabaseAdmin.from('cargo_doc_folders').delete().eq('id', folder.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success('Pièce supprimée');
      qc.invalidateQueries({ queryKey: ['cargo', 'doc-folders', v.folder.shipment_id] });
      qc.invalidateQueries({ queryKey: ['cargo', 'documents'] });
    },
    onError: (e: Error) => toast.error(`Suppression impossible : ${e.message}`),
  });
}

/**
 * Liens signés (10 min) pour afficher les miniatures et l'aperçu — le
 * classeur est privé, aucun fichier n'a d'adresse publique.
 */
export function useCargoDocumentUrls(docs: CargoDocument[] | undefined) {
  const paths = (docs ?? []).map((d) => d.storage_path).sort();
  return useQuery({
    queryKey: ['cargo', 'documents', 'urls', paths.join('|')],
    enabled: paths.length > 0,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, 600);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
      return out;
    },
    staleTime: 8 * 60_000,
  });
}

export async function openCargoDocument(doc: CargoDocument) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(doc.storage_path, 300);
  if (error || !data?.signedUrl) {
    toast.error("Impossible d'ouvrir ce document");
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener');
}

/** Télécharger un fichier sous son nom (lien signé « download », 5 min). */
export async function downloadCargoDocument(doc: CargoDocument, name?: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(doc.storage_path, 300, { download: name ?? doc.file_name });
  if (error || !data?.signedUrl) {
    toast.error('Téléchargement impossible');
    return;
  }
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

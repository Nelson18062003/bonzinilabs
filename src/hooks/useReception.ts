// ============================================================
// RÉCEPTION DES COLIS — les hooks du réceptionnaire (app admin, donc
// `supabaseAdmin`, jamais `supabase` : .claude/rules/supabase-clients.md).
//
// Toutes les RPC renvoient `{ success, error?, ... }` sans lever : chaque
// appel vérifie `success` — un refus d'autorisation ne doit jamais passer
// pour un succès. Les RPC arrivent avec la migration 20260920100000 ; tant
// que `/gen-types` n'a pas tourné, elles passent par `rpcJson`, typé ici.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { validateUploadFile } from '@/lib/utils';
import type { BroughtBy, DayStats, Deposit, ParcelKind, ParcelWithDeposit, ReceptionClient, ReceptionLocation, ReceptionistRow, StockByClient, StockStats, SupplierInfo } from '@/lib/reception';

// Les RPC de la migration 20261002100000 (photos multiples, contrôle total)
// passent aussi par `rpcJson` tant que `/gen-types` n'a pas tourné.

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) throw new Error((res as { error?: string })?.error || 'Opération refusée');
  return res as T;
}

export const RECEPTION_KEYS = {
  day: (day?: string) => ['reception', 'day', day ?? 'today'] as const,
  deposit: (id: string) => ['reception', 'deposit', id] as const,
  pending: ['reception', 'pending'] as const,
  search: (q: string) => ['reception', 'search', q] as const,
};

/** Ma journée : mes dépôts du jour, mes totaux, le nombre de colis en attente. */
export function useReceptionDay(day?: string) {
  return useQuery({
    queryKey: RECEPTION_KEYS.day(day),
    queryFn: () => rpcJson<{ day: string; stats: DayStats; pending: number; deposits: Deposit[] }>('reception_my_day', day ? { p_day: day } : {}),
    staleTime: 15_000,
  });
}

export function useReceptionDeposit(id: string | undefined) {
  return useQuery({
    queryKey: RECEPTION_KEYS.deposit(id ?? ''),
    queryFn: () => rpcJson<{ deposit: Deposit }>('reception_get_deposit', { p_deposit_id: id }).then((r) => r.deposit),
    enabled: !!id,
  });
}

export function useReceptionPending() {
  return useQuery({
    queryKey: RECEPTION_KEYS.pending,
    queryFn: () => rpcJson<{ deposits: Deposit[] }>('reception_pending_deposits').then((r) => r.deposits),
  });
}

/** Recherche d'identité : code BZ, téléphone ou nom. Deux caractères minimum. */
export function useReceptionSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: RECEPTION_KEYS.search(q),
    queryFn: () => rpcJson<{ clients: ReceptionClient[] }>('reception_search_clients', { p_query: q }).then((r) => r.clients),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}

function useInvalidateReception() {
  const qc = useQueryClient();
  return (deposit?: Deposit) => {
    // Tout ce qui lit la réception… sauf les URL signées des photos : un chemin
    // ne change pas, le re-signer à chaque correction rechargerait la galerie.
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'reception' && q.queryKey[1] !== 'photo' });
    qc.invalidateQueries({ queryKey: ['cargo', 'parts'] });
    if (deposit) {
      qc.setQueryData(RECEPTION_KEYS.deposit(deposit.id), deposit);
      // Un colis retiré emporte sa ligne de devis : le devis du dépôt se relit.
      qc.invalidateQueries({ queryKey: ['cargo', 'quote', deposit.id] });
    }
  };
}

export function useOpenDeposit() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (input: { location: ReceptionLocation; clientUserId?: string | null; broughtBy: BroughtBy; representativeName?: string; representativePhone?: string; supplier?: SupplierInfo | null }) =>
      rpcJson<{ deposit: Deposit }>('reception_open_deposit', {
        p_location: input.location,
        p_client_user_id: input.clientUserId ?? null,
        p_brought_by: input.broughtBy,
        p_representative_name: input.representativeName ?? null,
        p_representative_phone: input.representativePhone ?? null,
        ...supplierArgs(input.supplier),
      }).then((r) => r.deposit),
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Les paramètres fournisseur des RPC, depuis l'objet de l'app. */
function supplierArgs(s: SupplierInfo | null | undefined): Record<string, unknown> {
  return {
    p_supplier_kind: s?.kind ?? null, p_supplier_name: s?.name ?? null, p_supplier_contact: s?.contact ?? null, p_supplier_phone: s?.phone ?? null,
    p_supplier_email: s?.email ?? null, p_supplier_wechat: s?.wechat ?? null, p_supplier_address: s?.address ?? null,
  };
}

/** Poser ou corriger le fournisseur d'un dépôt (null : aucun fournisseur). */
export function useSetSupplier() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (input: { depositId: string; supplier: SupplierInfo | null }) =>
      rpcJson<{ deposit: Deposit }>('reception_set_supplier', { p_deposit_id: input.depositId, ...supplierArgs(input.supplier) }).then((r) => r.deposit),
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** La mémoire : les fournisseurs déjà vus pour ce client, du plus récent au plus ancien. */
export function useClientSuppliers(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['reception', 'suppliers', userId],
    queryFn: () => rpcJson<{ suppliers: (SupplierInfo & { last_at: string })[] }>('reception_client_suppliers', { p_user_id: userId }).then((r) => r.suppliers.map((s) => ({ ...s, kind: s.kind ?? 'supplier' }))),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export interface AddParcelInput {
  depositId: string;
  kind: ParcelKind;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  description?: string;
  courierWaybill?: string;
  photoPath?: string | null;
  /** Plusieurs photos : la première devient la couverture. */
  photoPaths?: string[];
  copies?: number;
}

export function useAddParcel() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (input: AddParcelInput) =>
      rpcJson<{ deposit: Deposit }>('reception_add_parcel', {
        p_deposit_id: input.depositId,
        p_kind: input.kind,
        p_weight_kg: input.weightKg ?? null,
        p_length_cm: input.lengthCm ?? null,
        p_width_cm: input.widthCm ?? null,
        p_height_cm: input.heightCm ?? null,
        p_description: input.description ?? null,
        p_courier_waybill: input.courierWaybill ?? null,
        p_photo_path: input.photoPath ?? null,
        p_copies: input.copies ?? 1,
        p_photo_paths: input.photoPaths && input.photoPaths.length > 0 ? input.photoPaths : null,
      }).then((r) => r.deposit),
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Supprimer un colis. Dépôt ouvert : son réceptionnaire. Dépôt fermé :
 * l'équipe cargo, avec un motif (la base le refuse sans).
 */
export function useRemoveParcel() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (input: string | { parcelId: string; reason?: string }) => {
      const { parcelId, reason } = typeof input === 'string' ? { parcelId: input, reason: undefined } : input;
      return rpcJson<{ deposit: Deposit }>('reception_remove_parcel', { p_parcel_id: parcelId, p_reason: reason?.trim() || null }).then((r) => r.deposit);
    },
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCloseDeposit() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (input: { depositId: string; notes?: string }) =>
      rpcJson<{ deposit: Deposit }>('reception_close_deposit', { p_deposit_id: input.depositId, p_notes: input.notes ?? null }).then((r) => r.deposit),
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAssignDeposit() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (input: { depositId: string; clientUserId: string }) =>
      rpcJson<{ deposit: Deposit }>('reception_assign_client', { p_deposit_id: input.depositId, p_client_user_id: input.clientUserId }).then((r) => r.deposit),
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * La photo d'un colis : compressée (1 200 px, JPEG) puis déposée dans le seau
 * privé `parcel-photos/<dépôt>/<horodatage>.jpg`. Renvoie le chemin à
 * enregistrer sur le colis. Une photo prise au téléphone pèse 3 à 5 Mo ;
 * compressée, 150 ko — elle part même sur le réseau de l'entrepôt.
 */
export async function uploadParcelPhoto(depositId: string, file: File): Promise<string> {
  validateUploadFile(file);
  const compressed = await compressImage(file, 1200, 0.8);
  const path = `${depositId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabaseAdmin.storage.from('parcel-photos').upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Plusieurs photos d'un coup, envoyées en parallèle (trois à la fois : le réseau de l'entrepôt). */
export async function uploadParcelPhotos(depositId: string, files: File[]): Promise<string[]> {
  const out: string[] = new Array(files.length);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      out[i] = await uploadParcelPhoto(depositId, files[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  return out;
}

/*
 * Les URL signées, par LOTS. La galerie de la console affiche des centaines
 * de vignettes : une requête par vignette saturait le navigateur. Chaque
 * demande est mise en attente quelques millisecondes, puis toutes partent en
 * un seul `createSignedUrls` (100 chemins par appel). Les écrans continuent
 * d'appeler `useParcelPhotoUrl(path)` comme avant.
 */
type SignWaiter = { resolve: (url: string) => void; reject: (e: Error) => void };
let signQueue: Map<string, SignWaiter[]> | null = null;

async function flushSignQueue() {
  const batch = signQueue;
  signQueue = null;
  if (!batch) return;
  const paths = [...batch.keys()];
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    try {
      const { data, error } = await supabaseAdmin.storage.from('parcel-photos').createSignedUrls(chunk, 3600);
      if (error) throw new Error(error.message);
      const byPath = new Map((data ?? []).map((row) => [row.path, row]));
      for (const path of chunk) {
        const row = byPath.get(path);
        for (const w of batch.get(path) ?? []) {
          if (row?.signedUrl) w.resolve(row.signedUrl);
          else w.reject(new Error(row?.error || 'Photo introuvable'));
        }
      }
    } catch (e) {
      for (const path of chunk) for (const w of batch.get(path) ?? []) w.reject(e as Error);
    }
  }
}

function signParcelPhoto(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!signQueue) {
      signQueue = new Map();
      setTimeout(() => void flushSignQueue(), 12);
    }
    const waiters = signQueue.get(path) ?? [];
    waiters.push({ resolve, reject });
    signQueue.set(path, waiters);
  });
}

/** L'URL signée (1 h) d'une photo de colis — le seau est privé. */
export function useParcelPhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['reception', 'photo', path],
    queryFn: () => signParcelPhoto(path as string),
    enabled: !!path,
    staleTime: 50 * 60_000,
  });
}

// ── Les photos d'un colis : ajouter, retirer, choisir la couverture ─────────
export function useAddParcelPhotos() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: async (input: { depositId: string; parcelId: string; files: File[] }) => {
      const paths = await uploadParcelPhotos(input.depositId, input.files);
      return rpcJson<{ deposit: Deposit }>('reception_add_parcel_photos', { p_parcel_id: input.parcelId, p_paths: paths }).then((r) => r.deposit);
    },
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveParcelPhoto() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (photoId: string) => rpcJson<{ deposit: Deposit }>('reception_remove_parcel_photo', { p_photo_id: photoId }).then((r) => r.deposit),
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetParcelCover() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (photoId: string) => rpcJson<{ deposit: Deposit }>('reception_set_parcel_cover', { p_photo_id: photoId }).then((r) => r.deposit),
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Côté admin : la réception dans Bonzini Cargo ─────────────────────────

/** Vue d'ensemble sur une période : par réceptionnaire, et la liste des dépôts. */
export function useReceptionOverview(from: Date, to: Date) {
  return useQuery({
    queryKey: ['reception', 'overview', from.toISOString(), to.toISOString()],
    queryFn: () => rpcJson<{ by_receptionist: ReceptionistRow[]; deposits: Deposit[] }>('reception_overview', { p_from: from.toISOString(), p_to: to.toISOString() }),
    staleTime: 30_000,
  });
}

/** Ce qui attend à l'entrepôt (ou au bureau) : reçu, pas encore chargé. */
export function useReceptionStock(location?: ReceptionLocation | null) {
  return useQuery({
    queryKey: ['reception', 'stock', location ?? 'all'],
    queryFn: () => rpcJson<{ stats: StockStats; by_client: StockByClient[] }>('reception_stock', { p_location: location ?? null }),
    staleTime: 30_000,
  });
}

/** Les colis reçus d'un client, tous ses dépôts. */
export function useClientDeposits(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['reception', 'client', userId],
    queryFn: () => rpcJson<{ deposits: Deposit[] }>('reception_client_deposits', { p_user_id: userId }).then((r) => r.deposits),
    enabled: !!userId && enabled,
  });
}

/** Les colis déjà chargés dans une boîte. */
export function useShipmentParcels(shipmentId: string | null | undefined) {
  return useQuery({
    queryKey: ['reception', 'shipment', shipmentId],
    queryFn: () => rpcJson<{ parcels: ParcelWithDeposit[] }>('cargo_shipment_parcels', { p_shipment_id: shipmentId }).then((r) => r.parcels),
    enabled: !!shipmentId,
  });
}

/** Ce qu'on peut charger dans cette boîte. */
export function useLoadableParcels(shipmentId: string | null | undefined) {
  return useQuery({
    queryKey: ['reception', 'loadable', shipmentId],
    queryFn: () => rpcJson<{ client_user_id: string | null; parcels: ParcelWithDeposit[] }>('reception_loadable_parcels', { p_shipment_id: shipmentId }),
    enabled: !!shipmentId,
  });
}

export function useLoadParcels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { shipmentId: string; parcelIds: string[] }) =>
      rpcJson<{ loaded: number; weight_kg: number; cbm: number }>('cargo_load_parcels', { p_shipment_id: input.shipmentId, p_parcel_ids: input.parcelIds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reception'] }); qc.invalidateQueries({ queryKey: ['cargo'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnloadParcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (parcelId: string) => rpcJson<Record<string, never>>('cargo_unload_parcel', { p_parcel_id: parcelId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reception'] }); qc.invalidateQueries({ queryKey: ['cargo'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── L'entrée du module Cargo : ses deux parties en chiffres ─────────────────
export interface CargoPartsSummary {
  containers: number;
  containers_at_sea: number;
  air_open?: number;
  air_in_flight?: number;
  parcels_waiting: number;
  deposits_pending: number;
  deposits_today: number;
}

/** Container · Réception : les compteurs du sélecteur, en un seul appel (canViewCargo). */
export function useCargoPartsSummary() {
  return useQuery({
    queryKey: ['cargo', 'parts'],
    queryFn: () => rpcJson<CargoPartsSummary>('cargo_parts_summary'),
    staleTime: 30_000,
  });
}

// ── Le scan : un code client → une fiche, tout de suite ─────────────────────
export class UnknownCodeError extends Error {
  constructor(public readonly code: string) { super('unknown_code'); }
}

/**
 * Un code BZ (ou l'URL du QR) → le client, sans liste. Lève UnknownCodeError
 * si aucun client ne porte ce code, pour que l'écran le dise et continue à scanner.
 */
export function useClientByCode() {
  return useMutation({
    mutationFn: async (code: string): Promise<ReceptionClient> => {
      const { data, error } = await supabaseAdmin.rpc('reception_client_by_code' as never, { p_code: code } as never);
      if (error) throw new Error(error.message);
      const res = data as unknown as { success: boolean; error?: string; code?: string; client?: ReceptionClient };
      if (res?.success && res.client) return res.client;
      if (res?.error === 'unknown_code') throw new UnknownCodeError(res.code ?? code);
      throw new Error(res?.error || 'Opération refusée');
    },
  });
}

// ── Corriger ou compléter un colis (dépôt ouvert ou fermé, colis pas en boîte) ──
export type UpdateParcelInput = Omit<AddParcelInput, 'depositId' | 'copies'> & { parcelId: string; depositId: string };

export function useUpdateParcel() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (input: UpdateParcelInput) =>
      rpcJson<{ deposit: Deposit }>('reception_update_parcel', {
        p_parcel_id: input.parcelId,
        p_kind: input.kind,
        p_weight_kg: input.weightKg ?? null,
        p_length_cm: input.lengthCm ?? null,
        p_width_cm: input.widthCm ?? null,
        p_height_cm: input.heightCm ?? null,
        p_description: input.description ?? null,
        p_courier_waybill: input.courierWaybill ?? null,
        p_photo_path: input.photoPath ?? null,
        p_photo_paths: input.photoPaths && input.photoPaths.length > 0 ? input.photoPaths : null,
      }).then((r) => r.deposit),
    onSuccess: (dep) => invalidate(dep),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Les clients, côté réception : récents, et une fiche par client ──────────
export function useRecentClients() {
  return useQuery({
    queryKey: ['reception', 'clients', 'recent'],
    queryFn: () => rpcJson<{ clients: ReceptionClient[] }>('reception_recent_clients', { p_limit: 40 }).then((r) => r.clients),
    staleTime: 30_000,
  });
}

export function useReceptionClient(userId: string | undefined) {
  return useQuery({
    queryKey: ['reception', 'client-card', userId],
    queryFn: () => rpcJson<{ client: ReceptionClient }>('reception_client', { p_user_id: userId }).then((r) => r.client),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

// ── La console : la liste des dépôts, et le contrôle total ──────────────────
export type BoardScope = 'stock' | 'all' | 'cancelled';

export interface BoardQuery {
  scope: BoardScope;
  location?: ReceptionLocation | null;
  from?: Date | null;
  to?: Date | null;
}

/**
 * Les dépôts et leurs colis (photos comprises) : ce qui est en stock, ce qui
 * a été reçu sur une période, ou ce qui a été supprimé. Une seule source pour
 * les vues Dépôts, Colis et Photos de la console.
 */
export function useReceptionBoard(q: BoardQuery) {
  return useQuery({
    queryKey: ['reception', 'board', q.scope, q.location ?? 'all', q.from?.toISOString() ?? null, q.to?.toISOString() ?? null],
    queryFn: () => rpcJson<{ total: number; truncated: boolean; deposits: Deposit[] }>('reception_board', {
      p_scope: q.scope,
      p_location: q.location ?? null,
      p_from: q.from?.toISOString() ?? null,
      p_to: q.to?.toISOString() ?? null,
      p_limit: 1000,
    }),
    staleTime: 20_000,
  });
}

export interface UpdateDepositInput {
  depositId: string;
  location?: ReceptionLocation;
  broughtBy?: BroughtBy;
  /** Chaîne vide : on efface ; absent : on garde. */
  representativeName?: string;
  representativePhone?: string;
  notes?: string;
}

/** Corriger un dépôt (lieu, mode d'arrivée, apporteur, notes). */
export function useUpdateDeposit() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (input: UpdateDepositInput) =>
      rpcJson<{ deposit: Deposit }>('reception_update_deposit', {
        p_deposit_id: input.depositId,
        p_location: input.location ?? null,
        p_brought_by: input.broughtBy ?? null,
        p_representative_name: input.representativeName ?? null,
        p_representative_phone: input.representativePhone ?? null,
        p_notes: input.notes ?? null,
      }).then((r) => r.deposit),
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Supprimer un dépôt (suppression douce, motif obligatoire) — il se rétablit. */
export function useCancelDeposit() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (input: { depositId: string; reason: string }) =>
      rpcJson<{ deposit: Deposit }>('reception_cancel_deposit', { p_deposit_id: input.depositId, p_reason: input.reason.trim() }).then((r) => r.deposit),
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRestoreDeposit() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (depositId: string) => rpcJson<{ deposit: Deposit }>('reception_restore_deposit', { p_deposit_id: depositId }).then((r) => r.deposit),
    onSuccess: (deposit) => invalidate(deposit),
    onError: (e: Error) => toast.error(e.message),
  });
}

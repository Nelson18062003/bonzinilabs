/**
 * Sources des clients — d'où vient chaque client (un commercial, une
 * recommandation, un réseau social…), et ce que chaque source rapporte.
 *
 * Admin uniquement : tout passe par `supabaseAdmin`. L'origine d'un client ne
 * s'écrit QUE par `set_client_source` (un verrou en base ignore toute autre
 * écriture) — c'est elle qui décidera des commissions des commerciaux.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ClientSource = Database['public']['Tables']['client_sources']['Row'];
export type ClientSourceKind = 'commercial' | 'referral' | 'social' | 'online' | 'event' | 'other' | 'unknown';

/** Les catégories qu'on peut créer (« Je ne sais pas » est fournie d'office). */
export const SOURCE_KINDS: ReadonlyArray<{ kind: Exclude<ClientSourceKind, 'unknown'>; label: string; hint: string; withPhone: boolean }> = [
  { kind: 'commercial', label: 'Commercial', hint: 'Une personne qui apporte des clients', withPhone: true },
  { kind: 'referral', label: 'Recommandation', hint: 'Un client ou un proche qui a recommandé Bonzini', withPhone: true },
  { kind: 'social', label: 'Réseaux sociaux', hint: 'Facebook, TikTok, WhatsApp…', withPhone: false },
  { kind: 'online', label: 'En ligne', hint: 'Site, Google, ChatGPT…', withPhone: false },
  { kind: 'event', label: 'Événement', hint: 'Salon, flyer, rencontre…', withPhone: false },
  { kind: 'other', label: 'Autre', hint: 'Tout le reste', withPhone: false },
];

export function sourceKindLabel(kind: string | null | undefined): string {
  if (kind === 'unknown') return 'Inconnue';
  if (kind === 'none') return 'Non renseignée';
  return SOURCE_KINDS.find((k) => k.kind === kind)?.label ?? 'Autre';
}

interface RpcResult {
  success: boolean;
  error?: string;
}

function unwrap<T extends RpcResult>(data: unknown, fallback: string): T {
  const r = data as T;
  if (!r?.success) throw new Error(r?.error ?? fallback);
  return r;
}

/** Toutes les sources (actives d'abord), pour le sélecteur et l'écran de gestion. */
export function useClientSources(includeArchived = false) {
  return useQuery({
    queryKey: ['client-sources', includeArchived],
    queryFn: async (): Promise<ClientSource[]> => {
      let q = supabaseAdmin.from('client_sources').select('*').order('kind').order('label');
      if (!includeArchived) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useCreateClientSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { kind: Exclude<ClientSourceKind, 'unknown'>; label: string; phone?: string | null; notes?: string | null }) => {
      const { data, error } = await supabaseAdmin.rpc('create_client_source', {
        p_kind: args.kind,
        p_label: args.label,
        p_phone: args.phone ?? undefined,
        p_notes: args.notes ?? undefined,
      });
      if (error) throw error;
      return unwrap<RpcResult & { id: string; existing: boolean }>(data, 'Impossible d’ajouter la source');
    },
    onSuccess: (r) => {
      toast.success(r.existing ? 'Cette source existait déjà — elle est choisie' : 'Source ajoutée');
      return qc.invalidateQueries({ queryKey: ['client-sources'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateClientSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; label?: string; phone?: string | null; notes?: string | null; isActive?: boolean }) => {
      const { data, error } = await supabaseAdmin.rpc('update_client_source', {
        p_id: args.id,
        p_label: args.label ?? undefined,
        // '' efface ; undefined ne touche pas.
        p_phone: args.phone === undefined ? undefined : args.phone ?? '',
        p_notes: args.notes === undefined ? undefined : args.notes ?? '',
        p_is_active: args.isActive ?? undefined,
      });
      if (error) throw error;
      return unwrap<RpcResult>(data, 'Impossible de modifier la source');
    },
    onSuccess: () => {
      toast.success('Source mise à jour');
      qc.invalidateQueries({ queryKey: ['client-sources'] });
      qc.invalidateQueries({ queryKey: ['client-source-report'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Pose (ou change) l'origine d'un client. `silent` : pas de toast (création). */
export function useSetClientSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { userId: string; sourceId: string; silent?: boolean }) => {
      const { data, error } = await supabaseAdmin.rpc('set_client_source', { p_user_id: args.userId, p_source_id: args.sourceId });
      if (error) throw error;
      return unwrap<RpcResult>(data, 'Impossible d’enregistrer l’origine du client');
    },
    onSuccess: (_r, args) => {
      if (!args.silent) toast.success('Origine du client enregistrée');
      qc.invalidateQueries({ queryKey: ['client-origin', args.userId] });
      qc.invalidateQueries({ queryKey: ['client-source-report'] });
    },
    onError: (e: Error, args) => {
      if (!args.silent) toast.error(e.message);
    },
  });
}

/** L'origine d'un client (fiche client). */
export function useClientOrigin(userId: string | undefined) {
  return useQuery({
    queryKey: ['client-origin', userId],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('source_id, source_set_at, source:client_sources!clients_source_id_fkey(id, kind, label, phone)')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      const row = data as { source_id: string | null; source_set_at: string | null; source: Pick<ClientSource, 'id' | 'kind' | 'label' | 'phone'> | null } | null;
      return row;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export interface SourceReportRow {
  source_id: string | null;
  kind: ClientSourceKind | 'none';
  label: string;
  phone: string | null;
  is_active: boolean;
  is_system: boolean;
  clients: number;
  new_clients: number;
  active_clients: number;
  deposits_xaf: number;
  deposits_count: number;
  payments_xaf: number;
  payments_count: number;
  parcels: number;
  parcels_kg: number;
  parcels_cbm: number;
}

export function useClientSourceReport(fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ['client-source-report', fromIso, toIso],
    queryFn: async (): Promise<SourceReportRow[]> => {
      const { data, error } = await supabaseAdmin.rpc('get_client_source_report', { p_from: fromIso, p_to: toIso });
      if (error) throw error;
      return unwrap<RpcResult & { rows: SourceReportRow[] }>(data, 'Rapport indisponible').rows;
    },
    staleTime: 30_000,
  });
}

export interface SourceClientRow {
  user_id: string;
  name: string;
  company: string | null;
  customer_code: string | null;
  phone: string | null;
  created_at: string;
  source_set_at: string | null;
  deposits_xaf: number;
  deposits_count: number;
  payments_xaf: number;
  payments_count: number;
  parcels: number;
  parcels_kg: number;
  parcels_cbm: number;
}

/** Les clients d'une source (`null` = sans origine renseignée). */
export function useClientSourceClients(sourceId: string | null, fromIso: string, toIso: string, enabled = true) {
  return useQuery({
    queryKey: ['client-source-report', 'clients', sourceId, fromIso, toIso],
    queryFn: async (): Promise<SourceClientRow[]> => {
      const { data, error } = await supabaseAdmin.rpc('get_client_source_clients', {
        p_source_id: sourceId as string,
        p_from: fromIso,
        p_to: toIso,
      });
      if (error) throw error;
      return unwrap<RpcResult & { rows: SourceClientRow[] }>(data, 'Liste indisponible').rows;
    },
    enabled,
    staleTime: 30_000,
  });
}

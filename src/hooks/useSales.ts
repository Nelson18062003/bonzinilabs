// ============================================================
// Ventes — prospects, tableaux de bord et objectifs. Un seul jeu de hooks
// pour l'espace du commercial (« /v », sa fiche seulement : RLS et RPC le
// limitent côté serveur) et pour le responsable (canManageSales), qui passe
// la fiche voulue en `sourceId`. Toujours supabaseAdmin : ce sont des
// sessions du personnel.
// ============================================================
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { CommercialCard, CommercialClient, Interest, ObjectiveMetric, ProspectStatus } from '@/lib/sales';

export interface Prospect {
  id: string;
  source_id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
  phone: string;
  phone_e164: string;
  city: string | null;
  interests: Interest[];
  notes: string | null;
  status: ProspectStatus;
  lost_reason: string | null;
  next_action_at: string | null;
  converted_user_id: string | null;
  converted_at: string | null;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
}

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) throw new Error((res as { error?: string })?.error || 'Opération refusée');
  return res as T;
}

export const SALES_KEY = ['sales'] as const;

function invalidateSales(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: SALES_KEY });
}

/* ── Prospects ─────────────────────────────────────────────────────────── */

/** Les prospects lisibles : les siens (commercial), ou ceux d'une fiche (responsable). */
export function useProspects(sourceId?: string | null) {
  return useQuery({
    queryKey: [...SALES_KEY, 'prospects', sourceId ?? 'mine'],
    queryFn: async () => {
      let q = supabaseAdmin.from('prospects').select('*').order('status_changed_at', { ascending: false });
      if (sourceId) q = q.eq('source_id', sourceId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Prospect[];
    },
  });
}

export interface ProspectInput {
  firstName: string;
  lastName?: string;
  phone: string;
  company?: string;
  city?: string;
  notes?: string;
  nextActionAt?: string | null;
  interests?: Interest[];
  /** Responsable seulement : la fiche du commercial. */
  sourceId?: string | null;
}

export function useCreateProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ProspectInput) =>
      rpcJson<{ id: string }>('prospect_create', {
        p_first_name: p.firstName.trim(),
        p_phone: p.phone.trim(),
        p_last_name: p.lastName?.trim() || null,
        p_company: p.company?.trim() || null,
        p_city: p.city?.trim() || null,
        p_notes: p.notes?.trim() || null,
        p_next_action_at: p.nextActionAt || null,
        p_interests: p.interests ?? [],
        p_source_id: p.sourceId ?? null,
      }),
    onSuccess: () => {
      invalidateSales(qc);
      toast.success('Prospect ajouté');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface ProspectPatch {
  id: string;
  firstName?: string;
  /** '' efface ; absent = inchangé (de même pour les champs facultatifs). */
  lastName?: string;
  phone?: string;
  company?: string;
  city?: string;
  notes?: string;
  nextActionAt?: string | null;
  interests?: Interest[];
}

export function useUpdateProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ProspectPatch) =>
      rpcJson<object>('prospect_update', {
        p_id: p.id,
        p_first_name: p.firstName ?? null,
        p_last_name: p.lastName ?? null,
        p_phone: p.phone ?? null,
        p_company: p.company ?? null,
        p_city: p.city ?? null,
        p_notes: p.notes ?? null,
        p_next_action_at: p.nextActionAt ?? null,
        p_clear_next_action: p.nextActionAt === null,
        p_interests: p.interests ?? null,
      }),
    onSuccess: () => {
      invalidateSales(qc);
      toast.success('Prospect enregistré');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetProspectStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: Exclude<ProspectStatus, 'won'>; reason?: string }) =>
      rpcJson<object>('prospect_set_status', { p_id: id, p_status: status, p_reason: reason?.trim() || null }),
    onSuccess: () => invalidateSales(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReassignProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sourceId }: { id: string; sourceId: string }) => rpcJson<object>('prospect_reassign', { p_id: id, p_source_id: sourceId }),
    onSuccess: () => {
      invalidateSales(qc);
      toast.success('Prospect confié');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ── Tableaux de bord ──────────────────────────────────────────────────── */

export function useCommercialDashboard(month: string, sourceId?: string | null, enabled = true) {
  return useQuery({
    queryKey: [...SALES_KEY, 'dashboard', sourceId ?? 'mine', month],
    queryFn: () => rpcJson<CommercialCard & { month: string }>('commercial_dashboard', { p_month: month, p_source_id: sourceId ?? null }),
    enabled,
  });
}

export function useCommercialClients(month: string, sourceId?: string | null, enabled = true) {
  return useQuery({
    queryKey: [...SALES_KEY, 'clients', sourceId ?? 'mine', month],
    queryFn: () => rpcJson<{ rows: CommercialClient[] }>('commercial_clients', { p_month: month, p_source_id: sourceId ?? null }).then((r) => r.rows),
    enabled,
  });
}

export function useSalesOverview(month: string, enabled = true) {
  return useQuery({
    queryKey: [...SALES_KEY, 'overview', month],
    queryFn: () => rpcJson<{ rows: CommercialCard[] }>('sales_overview', { p_month: month }).then((r) => r.rows),
    enabled,
  });
}

export function useSetObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, month, metric, target }: { sourceId: string; month: string; metric: ObjectiveMetric; target: number | null }) =>
      rpcJson<object>('set_commercial_objective', { p_source_id: sourceId, p_month: month, p_metric: metric, p_target: target }),
    onSuccess: () => invalidateSales(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ── Formulaire « Nouveau client » ─────────────────────────────────────── */

export interface ProspectMatch {
  found: boolean;
  prospect_id?: string;
  prospect_name?: string;
  source_id?: string;
  source_label?: string;
  source_active?: boolean;
}

/** Ce numéro est-il le prospect d'un commercial ? (`phone` au format international, sinon rien.) */
export function useProspectLookup(phoneE164: string | null) {
  return useQuery({
    queryKey: [...SALES_KEY, 'lookup', phoneE164],
    queryFn: () => rpcJson<ProspectMatch>('prospect_lookup_phone', { p_phone: phoneE164 }),
    enabled: !!phoneE164,
    staleTime: 60_000,
    retry: false,
  });
}

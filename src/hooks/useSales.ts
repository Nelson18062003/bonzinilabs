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
import type { Gender } from '@/lib/people';

/** Un numéro de plus d'un prospect (le principal reste `phone_e164`). */
export interface ProspectPhone {
  phone_e164: string;
  country_iso: string | null;
  label: string | null;
}

export interface Prospect {
  id: string;
  source_id: string;
  first_name: string;
  last_name: string | null;
  company: string | null;
  phone: string;
  phone_e164: string;
  city: string | null;
  /** MALE / FEMALE ; null pour un prospect saisi avant le 06/10. */
  gender: Gender | null;
  /** « AAAA-MM-JJ » ou null. */
  birth_date: string | null;
  email: string | null;
  /** « Ses plus gros problèmes aujourd'hui » — champ libre, le cœur de l'entretien. */
  pain_points: string | null;
  /** « Ce que nous pouvons faire pour l'aider » — champ libre. */
  help_needed: string | null;
  /** Les autres numéros (table prospect_phones), par `position` ; absent sur une réponse ancienne. */
  phones?: (ProspectPhone & { position?: number })[];
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

const WITH_PHONES = '*, phones:prospect_phones(phone_e164, country_iso, label, position)';

/**
 * Les prospects lisibles : les siens (commercial), ou ceux d'une fiche
 * (responsable). Avec leurs autres numéros (`prospect_phones`) ; tant que la
 * migration du 06/10 n'est pas passée, PostgREST ne connaît pas la relation
 * (PGRST200) : la liste se relit sans eux plutôt que de tomber en erreur.
 */
export function useProspects(sourceId?: string | null) {
  return useQuery({
    queryKey: [...SALES_KEY, 'prospects', sourceId ?? 'mine'],
    queryFn: async () => {
      const read = (columns: string) => {
        let q = supabaseAdmin.from('prospects').select(columns).order('status_changed_at', { ascending: false });
        if (sourceId) q = q.eq('source_id', sourceId);
        return q;
      };
      let { data, error } = await read(WITH_PHONES);
      if (error?.code === 'PGRST200') ({ data, error } = await read('*'));
      if (error) throw new Error(error.message);
      // Les autres numéros dans leur ordre de saisie.
      return ((data ?? []) as unknown as Prospect[]).map((p) => ({
        ...p,
        phones: [...(p.phones ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      }));
    },
  });
}

export interface ProspectInput {
  firstName: string;
  /** Obligatoire au serveur depuis le 06/10, comme `city` et `gender`. */
  lastName: string;
  /** Le numéro principal, au format international. */
  phone: string;
  /** Les AUTRES numéros (sans le principal), au format international. */
  phones?: ProspectPhone[];
  company?: string;
  city: string;
  gender: Gender;
  /** « AAAA-MM-JJ », facultative. */
  birthDate?: string | null;
  email?: string;
  painPoints?: string;
  helpNeeded?: string;
  notes?: string;
  nextActionAt?: string | null;
  interests?: Interest[];
  /** Responsable seulement : la fiche du commercial. */
  sourceId?: string | null;
}

/**
 * Options des mutations de l'assistant. `onCreated` / `onUpdated`
 * s'exécutent même si l'écran a été quitté pendant l'envoi (rappels de la
 * mutation, pas de l'appel) : le brouillon s'efface quoi qu'il arrive. `quietErrors` : l'écran
 * dit lui-même le refus, sous le champ en cause — pas de toast en double.
 */
export interface ProspectMutationOptions {
  onCreated?: (id: string) => void;
  onUpdated?: () => void;
  quietErrors?: boolean;
}

export function useCreateProspect({ onCreated, quietErrors = false }: ProspectMutationOptions = {}) {
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
        p_gender: p.gender,
        p_birth_date: p.birthDate || null,
        p_email: p.email?.trim() || null,
        p_phones: p.phones ?? [],
        p_pain_points: p.painPoints?.trim() || null,
        p_help_needed: p.helpNeeded?.trim() || null,
      }),
    onSuccess: (r) => {
      invalidateSales(qc);
      toast.success('Prospect ajouté');
      onCreated?.(r.id);
    },
    onError: (e: Error) => {
      if (!quietErrors) toast.error(e.message);
    },
  });
}

export interface ProspectPatch {
  id: string;
  firstName?: string;
  /** Absent = inchangé. Nom et ville sont obligatoires : '' est refusé par le serveur. */
  lastName?: string;
  phone?: string;
  /** La liste COMPLÈTE des autres numéros (absent = inchangée, [] = aucun). */
  phones?: ProspectPhone[];
  /** '' efface ; absent = inchangé (de même pour les champs facultatifs). */
  company?: string;
  city?: string;
  gender?: Gender;
  /** « AAAA-MM-JJ » ; null = l'effacer ; absent = inchangée. */
  birthDate?: string | null;
  /** '' efface ; absent = inchangée. */
  email?: string;
  /** '' efface ; absent = inchangé. */
  painPoints?: string;
  helpNeeded?: string;
  notes?: string;
  nextActionAt?: string | null;
  interests?: Interest[];
}

export function useUpdateProspect({ onUpdated, quietErrors = false }: Pick<ProspectMutationOptions, 'onUpdated' | 'quietErrors'> = {}) {
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
        p_gender: p.gender ?? null,
        p_birth_date: p.birthDate || null,
        p_clear_birth_date: p.birthDate === null,
        p_email: p.email ?? null,
        p_phones: p.phones ?? null,
        p_pain_points: p.painPoints ?? null,
        p_help_needed: p.helpNeeded ?? null,
      }),
    onSuccess: () => {
      invalidateSales(qc);
      toast.success('Prospect enregistré');
      onUpdated?.();
    },
    onError: (e: Error) => {
      if (!quietErrors) toast.error(e.message);
    },
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
  /** Sa fiche, pour pré-remplir le nouveau client (06/10) — absents sur une base pas encore migrée. */
  first_name?: string;
  last_name?: string | null;
  company?: string | null;
  city?: string | null;
  email?: string | null;
  gender?: Gender | null;
  birth_date?: string | null;
  /** Son numéro principal (celui tapé peut être un de ses autres numéros). */
  phone_e164?: string;
  /** Ses autres numéros. */
  phones?: ProspectPhone[];
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

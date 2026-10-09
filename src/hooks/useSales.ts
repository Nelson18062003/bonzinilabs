// ============================================================
// Ventes — prospects, tableaux de bord et objectifs. Un seul jeu de hooks
// pour l'espace du commercial (« /v », sa fiche seulement : RLS et RPC le
// limitent côté serveur) et pour le responsable (canManageSales), qui passe
// la fiche voulue en `sourceId`. Toujours supabaseAdmin : ce sont des
// sessions du personnel.
// ============================================================
import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { TO_VERIFY_NOTE, type CommercialCard, type CommercialClient, type Interest, type ObjectiveMetric, type ProspectStatus } from '@/lib/sales';
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
  /** `toVerify` : un des numéros est déjà celui d'un client — la fiche attend la direction (07/10). */
  onCreated?: (id: string, toVerify: boolean) => void;
  onUpdated?: () => void;
  quietErrors?: boolean;
}

export function useCreateProspect({ onCreated, quietErrors = false }: ProspectMutationOptions = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ProspectInput) =>
      rpcJson<{ id: string; to_verify?: boolean }>('prospect_create', {
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
      if (r.to_verify) toast.success('Prospect enregistré : la direction va vérifier ce numéro', { description: TO_VERIFY_NOTE });
      else toast.success('Prospect ajouté');
      onCreated?.(r.id, !!r.to_verify);
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

/**
 * La réponse de `prospect_update` (07/10, relecture) : le statut FINAL de la
 * fiche. `to_verify` : elle attend la direction ; `notified` : cette
 * modification vient d'ouvrir une vérification (la direction est prévenue) ;
 * `released` : elle vient de sortir de « À vérifier » (le numéro du client a
 * été retiré ou corrigé) — redevenue « À contacter », ou « Perdu » si un de
 * ses numéros reste celui d'un client.
 */
export interface ProspectUpdateResult {
  to_verify?: boolean;
  status?: ProspectStatus;
  notified?: boolean;
  released?: boolean;
}

/** Ce que dit le toast après une modification (un serveur d'avant le 07/10 ne renvoie que `to_verify`, au sens « vient d'être prévenue »). */
export function updateToast(r: ProspectUpdateResult): { title: string; description?: string } {
  if (r.notified ?? r.to_verify) return { title: 'Prospect enregistré : la direction va vérifier ce numéro', description: TO_VERIFY_NOTE };
  if (r.released) {
    return r.status === 'lost'
      ? { title: 'Prospect enregistré', description: 'Un de ses numéros est déjà celui d’un client Bonzini\u00a0: la fiche est classée «\u00a0Perdu\u00a0».' }
      : { title: 'Prospect enregistré', description: 'La fiche n’attend plus la direction\u00a0: elle est de nouveau «\u00a0À contacter\u00a0».' };
  }
  if (r.to_verify) return { title: 'Prospect enregistré', description: 'La fiche attend toujours la décision de la direction.' };
  return { title: 'Prospect enregistré' };
}

export function useUpdateProspect({ onUpdated, quietErrors = false }: Pick<ProspectMutationOptions, 'onUpdated' | 'quietErrors'> = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ProspectPatch) =>
      rpcJson<ProspectUpdateResult>('prospect_update', {
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
    onSuccess: (r) => {
      invalidateSales(qc);
      const t = updateToast(r);
      if (t.description) toast.success(t.title, { description: t.description });
      else toast.success(t.title);
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
    mutationFn: ({ id, status, reason }: { id: string; status: Exclude<ProspectStatus, 'won' | 'to_verify'>; reason?: string }) =>
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

/* ── Numéro déjà client, prospect ↔ client (07/10) ─────────────────────── */

/**
 * Ce que le commercial peut savoir d'un numéro pendant la saisie, et rien de
 * plus (il n'a pas accès à la base des clients) :
 *   free        libre ;
 *   client      déjà celui d'un client Bonzini (lequel : il ne le sait pas) —
 *               la fiche partira « À vérifier » et la direction sera prévenue ;
 *   own_client  déjà celui d'un de SES clients (refusé) ;
 *   mine        déjà un de ses prospects ouverts (refusé) ;
 *   other       déjà suivi par un autre commercial (refusé) ;
 *   invalid     illisible.
 */
export type PhoneCheckStatus = 'free' | 'client' | 'own_client' | 'mine' | 'other' | 'invalid';

export function useProspectPhoneCheck(phoneE164: string | null, excludeProspectId?: string | null) {
  return useQuery({
    queryKey: [...SALES_KEY, 'phone-check', phoneE164, excludeProspectId ?? null],
    queryFn: () =>
      rpcJson<{ status: PhoneCheckStatus; prospect_id?: string }>('prospect_phone_check', {
        p_phone: phoneE164,
        p_exclude_prospect_id: excludeProspectId ?? null,
      }),
    enabled: !!phoneE164,
    staleTime: 30_000,
    retry: false,
  });
}

/** Ce qui empêcherait de rouvrir une fiche (le numéro d'un client, d'un de SES clients, d'un autre de ses prospects, suivi ailleurs). */
export type ReopenBlock = Exclude<PhoneCheckStatus, 'free' | 'invalid'>;

/**
 * Tous les numéros d'une fiche, vérifiés d'un coup (la fiche elle-même
 * exclue ; même cache que `useProspectPhoneCheck`) : ce que dirait sa
 * réouverture. `blocking` : le premier statut qui l'empêcherait, null sinon ;
 * `pending` tant qu'une réponse manque. Une erreur ne bloque rien (le
 * serveur tranche).
 */
export function useProspectNumbersCheck(numbers: string[], excludeProspectId: string, enabled = true) {
  const results = useQueries({
    queries: numbers.map((n) => ({
      queryKey: [...SALES_KEY, 'phone-check', n, excludeProspectId],
      queryFn: () =>
        rpcJson<{ status: PhoneCheckStatus; prospect_id?: string }>('prospect_phone_check', { p_phone: n, p_exclude_prospect_id: excludeProspectId }),
      enabled: enabled && !!n,
      staleTime: 30_000,
      retry: false,
    })),
  });
  const statuses = results.map((r) => r.data?.status);
  const blocking = (statuses.find((st) => st === 'client' || st === 'own_client' || st === 'mine' || st === 'other') as ReopenBlock | undefined) ?? null;
  return { pending: enabled && results.some((r) => r.isLoading), blocking: enabled ? blocking : null };
}

/** Le client existant qu'un numéro saisi par un commercial a reconnu (direction seulement). */
export interface ClaimClient {
  user_id: string;
  name: string;
  company: string | null;
  customer_code: string | null;
  phone_e164: string | null;
  email: string | null;
  city: string | null;
  created_at: string;
  /** Son origine actuelle (ex. « Commercial · Rodrigue Tchami »), null si aucune. */
  source_id: string | null;
  source_label: string | null;
  source_kind: string | null;
  deposits_count: number;
  payments_count: number;
  last_activity_at: string | null;
}

export interface ProspectClaim {
  claim_id: string;
  prospect: Prospect;
  /** La fiche commercial qui a saisi le numéro. */
  source_id: string;
  source_label: string;
  /** Fiche commercial archivée (false) : on ne lui attribue pas de client — la confier d'abord à un commercial actif. */
  source_active?: boolean;
  matched_phone: string;
  created_at: string;
  /** La dernière fois que la direction a déjà REFUSÉ ce client à ce commercial (sur cette fiche ou une autre), sinon null. */
  previously_rejected_at?: string | null;
  client: ClaimClient;
}

/** Les fiches « À vérifier » en attente de décision (canManageSales). */
export function useProspectClaims(enabled = true) {
  return useQuery({
    queryKey: [...SALES_KEY, 'claims'],
    queryFn: () => rpcJson<{ rows: ProspectClaim[] }>('prospect_claims_pending').then((r) => r.rows),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * La décision de la direction : `attribute` = ce client est bien celui du
 * commercial (son origine passe au commercial, le prospect « devenu client ») ;
 * `reject` = non (le prospect passe « perdu » avec le motif fixe « Déjà client
 * de Bonzini » ; la note reste interne à la direction).
 */
export function useResolveProspectClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { prospectId: string; decision: 'attribute' | 'reject'; clientUserId?: string | null; note?: string }) =>
      rpcJson<{ decision: string }>('prospect_resolve_claim', {
        p_prospect_id: p.prospectId,
        p_decision: p.decision,
        p_client_user_id: p.clientUserId ?? null,
        p_note: p.note?.trim() || null,
      }),
    onSuccess: (_, v) => {
      invalidateSales(qc);
      void qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(v.decision === 'attribute' ? 'Client attribué au commercial' : 'Fiche refusée');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Ce qui empêche (ou non) de repasser un client en prospect — super admin. */
export interface ClientProspectEligibility {
  eligible: boolean;
  /** En clair, ce qui bloque (« 3 dépôts », « solde de 25 000 XAF »…) ; vide si possible. */
  blockers: string[];
  /**
   * Ce qui sera effacé AUSSI sans bloquer (« 1 bénéficiaire enregistré… »,
   * « Sa conversation avec le support… », KYC, notes) — gardé au journal.
   * Absent d'un serveur plus ancien.
   */
  warnings?: string[];
  /** La fiche commercial proposée (l'origine du client si c'est un commercial). */
  suggested_source_id: string | null;
  /** Un prospect « devenu client » qui serait rouvert plutôt que recréé. */
  reopen_prospect_id: string | null;
}

export function useClientProspectEligibility(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...SALES_KEY, 'client-to-prospect', userId],
    queryFn: () => rpcJson<ClientProspectEligibility>('admin_client_prospect_eligibility', { p_user_id: userId }),
    enabled: enabled && !!userId,
    staleTime: 0,
    retry: false,
  });
}

/**
 * Repasser un client SANS aucune opération en prospect : son compte est
 * supprimé. Pas de toast de succès ici : la fenêtre dit elle-même « … est
 * maintenant un prospect de X », avec le lien vers le commercial.
 */
export function useClientToProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { userId: string; sourceId: string; reason?: string }) =>
      rpcJson<{ prospect_id: string; reopened: boolean }>('admin_client_to_prospect', {
        p_user_id: p.userId,
        p_source_id: p.sourceId,
        p_reason: p.reason?.trim() || null,
      }),
    onSuccess: () => {
      invalidateSales(qc);
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['admin-clients'] });
      void qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

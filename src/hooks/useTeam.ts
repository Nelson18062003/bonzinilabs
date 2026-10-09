// ============================================================
// « Mes équipes » — les comptes du personnel (super admin seul : chaque RPC
// vérifie canManageUsers côté serveur). Création, modification et lien d'un
// commercial à sa fiche passent par des RPC journalisées ; plus d'UPDATE
// direct sur user_roles.
//
// Numéros et site (06/10) : plusieurs numéros au format international
// (choisis avec leur pays à l'écran, le premier est le principal) et le site
// du membre (Guangzhou · bureau, Douala…) passent par team_set_member_profile.
// ============================================================
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { AppRole } from '@/contexts/AdminAuthContext';

/** Un numéro du membre, au format international (le premier de la liste est le principal). */
export interface StaffPhone {
  phone_e164: string;
  country_iso: string | null;
  label: string | null;
}

/** Un site du personnel : Guangzhou · bureau, Guangzhou · entrepôt, Douala, Yaoundé… */
export interface StaffSite {
  id: string;
  code: string | null;
  label: string;
  country_iso: string | null;
  is_active?: boolean;
  /** Membres actifs rattachés (team_sites). */
  members?: number;
}

export interface TeamMember {
  user_id: string;
  role: AppRole;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  /** Le numéro principal (recopie du premier de `phones`). */
  phone: string | null;
  /** Tous les numéros, principal d'abord (vide si aucun). */
  phones: StaffPhone[];
  /** Le site du membre, s'il est renseigné. */
  site: Pick<StaffSite, 'id' | 'code' | 'label' | 'country_iso'> | null;
  avatar_url: string | null;
  is_disabled: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  /** La fiche « commercial » reliée au compte (commerciaux seulement). */
  source: { id: string; label: string; phone: string | null; is_active: boolean } | null;
}

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) throw new Error((res as { error?: string })?.error || 'Opération refusée');
  return res as T;
}

export const TEAM_KEY = ['team'] as const;

/** Tout ce qui montre un membre ou une fiche commercial se rafraîchit ensemble. */
export function invalidateTeam(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: TEAM_KEY });
  void qc.invalidateQueries({ queryKey: ['admin-users'] });
  void qc.invalidateQueries({ queryKey: ['client-sources'] });
  void qc.invalidateQueries({ queryKey: ['sales'] });
}

export function useTeamMembers(enabled = true) {
  return useQuery({
    queryKey: [...TEAM_KEY, 'members'],
    queryFn: () => rpcJson<{ rows: TeamMember[] }>('team_members').then((r) => r.rows),
    enabled,
    staleTime: 30_000,
  });
}

export interface NewMember {
  email: string;
  firstName: string;
  lastName: string;
  role: AppRole;
  /** Les numéros, principal d'abord, au format international (vide = aucun). */
  phones?: StaffPhone[];
  /** Le site du membre (facultatif). */
  siteId?: string | null;
  /** Commercial : une fiche existante à reprendre (elle garde ses clients). */
  sourceId?: string | null;
}

export interface CreatedMember {
  userId: string;
  email: string;
  tempPassword: string;
  sourceId: string | null;
  /** L'accès existe, mais ses numéros ou son site n'ont pas pu être enregistrés (à refaire depuis sa fiche). */
  profileFailed?: boolean;
}

export function useCreateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: NewMember): Promise<CreatedMember> => {
      const phones = m.phones ?? [];
      const created = await rpcJson<CreatedMember>('team_create_member', {
        p_email: m.email.trim(),
        p_first_name: m.firstName.trim(),
        p_last_name: m.lastName.trim(),
        p_role: m.role,
        p_phone: phones[0]?.phone_e164 ?? null,
        p_source_id: m.sourceId ?? null,
      });
      // Tous les numéros (avec leur pays et leur libellé) et le site, juste après :
      // l'accès doit exister. Un échec ici ne défait pas l'accès — il se dit.
      if (phones.length > 0 || m.siteId) {
        try {
          await rpcJson('team_set_member_profile', {
            p_user_id: created.userId,
            p_phones: phones.length > 0 ? phones : null,
            p_site_id: m.siteId ?? null,
          });
        } catch {
          return { ...created, profileFailed: true };
        }
      }
      return created;
    },
    onSuccess: () => invalidateTeam(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Les sites du personnel (avec le nombre de membres actifs de chacun). */
export function useTeamSites(enabled = true) {
  return useQuery({
    queryKey: [...TEAM_KEY, 'sites'],
    queryFn: () => rpcJson<{ sites: StaffSite[] }>('team_sites').then((r) => r.sites),
    enabled,
    staleTime: 60_000,
  });
}

/** Ajouter un site (« Bafoussam », « Lagos »…). */
export function useCreateTeamSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ label, countryIso }: { label: string; countryIso?: string | null }) =>
      rpcJson<{ id: string; label: string }>('team_create_site', { p_label: label.trim(), p_country_iso: countryIso ?? null }),
    onSuccess: (r) => {
      invalidateTeam(qc);
      toast.success(`Site « ${r.label} » ajouté`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Les numéros et le site d'un membre. `phones` : la liste COMPLÈTE, principal
 * d'abord (absent = inchangée) ; `siteId` : null = retirer, absent = inchangé.
 */
export function useSetMemberProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, phones, siteId }: { userId: string; phones?: StaffPhone[]; siteId?: string | null }) =>
      rpcJson<{ phone: string | null }>('team_set_member_profile', {
        p_user_id: userId,
        p_phones: phones ?? null,
        p_site_id: siteId ?? null,
        p_clear_site: siteId === null,
      }),
    onSuccess: () => invalidateTeam(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface MemberPatch {
  userId: string;
  firstName?: string;
  lastName?: string;
  role?: AppRole;
}

export function useUpdateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: MemberPatch) =>
      rpcJson<{ role: AppRole }>('team_update_member', {
        p_user_id: p.userId,
        p_first_name: p.firstName ?? null,
        p_last_name: p.lastName ?? null,
        // Les numéros passent par team_set_member_profile (liste complète, E.164) : jamais d'ici.
        p_phone: null,
        p_role: p.role ?? null,
      }),
    onSuccess: () => {
      invalidateTeam(qc);
      toast.success('Membre mis à jour');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Relie un compte commercial à sa fiche : une fiche existante, ou une nouvelle à son nom (sourceId absent). */
export function useLinkCommercial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, sourceId }: { userId: string; sourceId?: string | null }) =>
      rpcJson<{ source_id: string; label: string }>('team_link_commercial', { p_user_id: userId, p_source_id: sourceId ?? null }),
    onSuccess: (r) => {
      invalidateTeam(qc);
      toast.success(`Relié à la fiche « ${r.label} »`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ============================================================
// « Mes équipes » — les comptes du personnel (super admin seul : chaque RPC
// vérifie canManageUsers côté serveur). Création, modification et lien d'un
// commercial à sa fiche passent par des RPC journalisées ; plus d'UPDATE
// direct sur user_roles.
// ============================================================
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabaseAdmin } from '@/integrations/supabase/client';
import type { AppRole } from '@/contexts/AdminAuthContext';

export interface TeamMember {
  user_id: string;
  role: AppRole;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
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
  phone?: string | null;
  /** Commercial : une fiche existante à reprendre (elle garde ses clients). */
  sourceId?: string | null;
}

export interface CreatedMember {
  userId: string;
  email: string;
  tempPassword: string;
  sourceId: string | null;
}

export function useCreateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: NewMember) =>
      rpcJson<CreatedMember>('team_create_member', {
        p_email: m.email.trim(),
        p_first_name: m.firstName.trim(),
        p_last_name: m.lastName.trim(),
        p_role: m.role,
        p_phone: m.phone?.trim() || null,
        p_source_id: m.sourceId ?? null,
      }),
    onSuccess: () => invalidateTeam(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface MemberPatch {
  userId: string;
  firstName?: string;
  lastName?: string;
  /** '' efface le numéro ; absent = inchangé. */
  phone?: string;
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
        p_phone: p.phone ?? null,
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

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';
import type { ResetPasswordResult } from '@/types/admin';

// Les comptes se créent et se modifient par les RPC de « Mes équipes »
// (src/hooks/useTeam.ts) : team_create_member, team_update_member.

/**
 * Hook to toggle an admin's active/disabled status via RPC
 */
export function useToggleAdminStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, disabled }: { userId: string; disabled: boolean }) => {
      const { data, error } = await supabaseAdmin.rpc('toggle_admin_status', {
        p_target_user_id: userId,
        p_disabled: disabled,
      });

      if (error) throw new Error(error.message);
      // La RPC refuse en renvoyant { success: false } (soi-même, pas super admin) :
      // sans ce contrôle, l'écran annonçait « désactivé » alors que rien n'avait changé.
      const result = data as unknown as { success?: boolean; error?: string } | null;
      if (result && result.success === false) throw new Error(result.error || 'Changement de statut refusé');
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success(variables.disabled
        ? i18n.t('hooks.toggleAdminStatus.disabled', { ns: 'common', defaultValue: 'Compte admin désactivé' })
        : i18n.t('hooks.toggleAdminStatus.enabled', { ns: 'common', defaultValue: 'Compte admin réactivé' })
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.toggleAdminStatus.error', { ns: 'common', defaultValue: 'Erreur lors du changement de statut' }));
    },
  });
}

/**
 * Hook to reset an admin's password via RPC (SECURITY DEFINER)
 * Note: functions.invoke() fails with "Invalid JWT" due to GoTrueClient conflicts.
 * The admin_reset_password RPC is used instead.
 */
export function useResetAdminPassword() {
  return useMutation({
    mutationFn: async (userId: string): Promise<ResetPasswordResult> => {
      const { data: result, error } = await supabaseAdmin.rpc('admin_reset_password', {
        p_target_user_id: userId,
      });

      if (error) throw new Error(error.message);

      const rpcResult = result as unknown as ResetPasswordResult;
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || i18n.t('hooks.resetPassword.error', { ns: 'common', defaultValue: 'Erreur lors de la réinitialisation' }));
      }

      return rpcResult;
    },
    onSuccess: () => {
      toast.success(i18n.t('hooks.resetPassword.success', { ns: 'common', defaultValue: 'Mot de passe réinitialisé' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.resetPassword.errorFull', { ns: 'common', defaultValue: 'Erreur lors de la réinitialisation du mot de passe' }));
    },
  });
}
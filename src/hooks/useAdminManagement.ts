import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';
import type {
  CreateAdminData,
  CreateAdminResult,
  ResetPasswordResult,
} from '@/types/admin';
import type { AppRole } from '@/contexts/AdminAuthContext';

/**
 * Hook to create a new admin user via RPC (SECURITY DEFINER)
 */
export function useCreateAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAdminData): Promise<CreateAdminResult> => {
      const { data: result, error } = await supabaseAdmin.rpc('admin_create_admin', {
        p_email: data.email.trim(),
        p_first_name: data.firstName.trim(),
        p_last_name: data.lastName.trim(),
        p_role: data.role,
      });

      if (error) throw new Error(error.message);

      const rpcResult = result as unknown as CreateAdminResult;
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || i18n.t('hooks.createAdmin.error', { ns: 'common', defaultValue: 'Erreur lors de la création' }));
      }

      return rpcResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(i18n.t('hooks.createAdmin.success', { ns: 'common', defaultValue: 'Admin créé avec succès' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.createAdmin.errorFull', { ns: 'common', defaultValue: "Erreur lors de la création de l'admin" }));
    },
  });
}

/**
 * Hook to update an admin's profile (first name, last name)
 */
export function useUpdateAdminProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; firstName: string; lastName: string }) => {
      const { error } = await supabaseAdmin
        .from('user_roles')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
        })
        .eq('user_id', data.userId);

      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(i18n.t('hooks.updateAdminProfile.success', { ns: 'common', defaultValue: 'Profil admin modifié' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.updateAdminProfile.error', { ns: 'common', defaultValue: 'Erreur lors de la modification du profil' }));
    },
  });
}

/**
 * Hook to update an admin's role
 */
export function useUpdateAdminRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; role: AppRole }) => {
      const { error } = await supabaseAdmin
        .from('user_roles')
        .update({ role: data.role })
        .eq('user_id', data.userId);

      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(i18n.t('hooks.updateAdminRole.success', { ns: 'common', defaultValue: 'Rôle admin modifié' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.updateAdminRole.error', { ns: 'common', defaultValue: 'Erreur lors de la modification du rôle' }));
    },
  });
}

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
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
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

      const rpcResult = result as ResetPasswordResult;
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
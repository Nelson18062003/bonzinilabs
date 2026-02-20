import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  CreateAdminData,
  CreateAdminResult,
  ResetPasswordResult,
} from '@/types/admin';
import type { AppRole } from '@/contexts/AdminAuthContext';

/**
 * Hook to create a new admin user via edge function
 */
export function useCreateAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAdminData): Promise<CreateAdminResult> => {
      const { data: result, error } = await supabaseAdmin.functions.invoke('create-admin', {
        body: {
          email: data.email.trim(),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          role: data.role,
        },
      });

      if (error) throw new Error(error.message);

      const rpcResult = result as CreateAdminResult;
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'Erreur lors de la création');
      }

      return rpcResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Admin créé avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création de l\'admin');
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
        .from('profiles')
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
      toast.success('Profil admin modifié');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la modification du profil');
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
      toast.success('Rôle admin modifié');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la modification du rôle');
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
        p_user_id: userId,
        p_disabled: disabled,
      });

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(variables.disabled ? 'Compte admin désactivé' : 'Compte admin réactivé');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors du changement de statut');
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
        throw new Error(rpcResult?.error || 'Erreur lors de la réinitialisation');
      }

      return rpcResult;
    },
    onSuccess: () => {
      toast.success('Mot de passe réinitialisé');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la réinitialisation du mot de passe');
    },
  });
}
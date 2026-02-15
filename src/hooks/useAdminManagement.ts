import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  CreateAdminData,
  UpdateAdminData,
  CreateAdminResult,
  ResetPasswordResult,
  AdminRpcResult
} from '@/types/admin';
import type { AppRole } from '@/contexts/AdminAuthContext';

/**
 * Hook to create a new admin user via RPC
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

      if (error) {
        throw new Error(error.message);
      }

      const rpcResult = result as unknown as CreateAdminResult;
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
    mutationFn: async (data: { userId: string; firstName: string; lastName: string }): Promise<AdminRpcResult> => {
      const { data: result, error } = await supabaseAdmin.rpc('update_admin_profile', {
        p_target_user_id: data.userId,
        p_first_name: data.firstName,
        p_last_name: data.lastName,
      });

      if (error) {
        throw new Error(error.message);
      }

      const rpcResult = result as AdminRpcResult;
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'Erreur lors de la mise à jour');
      }

      return rpcResult;
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
    mutationFn: async (data: { userId: string; role: AppRole }): Promise<AdminRpcResult> => {
      const { data: result, error } = await supabaseAdmin.rpc('update_admin_role', {
        p_target_user_id: data.userId,
        p_new_role: data.role,
      });

      if (error) {
        throw new Error(error.message);
      }

      const rpcResult = result as AdminRpcResult;
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'Erreur lors de la mise à jour du rôle');
      }

      return rpcResult;
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
 * Hook to toggle admin status (enable/disable)
 */
export function useToggleAdminStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, disabled }: { userId: string; disabled: boolean }): Promise<AdminRpcResult> => {
      const { data: result, error } = await supabaseAdmin.rpc('toggle_admin_status', {
        p_target_user_id: userId,
        p_disabled: disabled,
      });

      if (error) {
        throw new Error(error.message);
      }

      const rpcResult = result as AdminRpcResult;
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'Erreur lors de la modification du statut');
      }

      return rpcResult;
    },
    onSuccess: (_, { disabled }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(disabled ? 'Admin désactivé' : 'Admin réactivé');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la modification du statut');
    },
  });
}

/**
 * Hook to reset an admin's password via RPC
 */
export function useResetAdminPassword() {
  return useMutation({
    mutationFn: async (userId: string): Promise<ResetPasswordResult> => {
      const { data: result, error } = await supabaseAdmin.rpc('admin_reset_password', {
        p_target_user_id: userId,
      });

      if (error) {
        throw new Error(error.message);
      }

      const rpcResult = result as unknown as ResetPasswordResult;
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

/**
 * Hook to update last login timestamp
 * Called after successful admin login
 */
export function useUpdateAdminLastLogin() {
  return useMutation({
    mutationFn: async (): Promise<AdminRpcResult> => {
      const { data: result, error } = await supabaseAdmin.rpc('update_admin_last_login');

      if (error) {
        console.error('Error updating last login:', error);
        return { success: false, error: error.message };
      }

      return result as AdminRpcResult;
    },
  });
}

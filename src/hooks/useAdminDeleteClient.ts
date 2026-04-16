import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import i18n from '@/i18n';

export function useAdminDeleteClient() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabaseAdmin.rpc('admin_delete_client', {
        p_user_id: userId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        throw new Error(result.error || i18n.t('hooks.deleteClient.error', { ns: 'common', defaultValue: 'Échec de la suppression' }));
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(i18n.t('hooks.deleteClient.success', { ns: 'common', defaultValue: 'Client supprimé avec succès' }));
      navigate('/admin/clients', { replace: true });
    },
    onError: (error) => {
      toast.error(i18n.t('hooks.deleteClient.errorPrefix', { ns: 'common', defaultValue: `Erreur: ${error.message}`, message: error.message }));
    },
  });
}
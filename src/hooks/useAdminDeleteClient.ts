import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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
        throw new Error(result.error || 'Échec de la suppression');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Client supprimé avec succès');
      navigate('/admin/clients', { replace: true });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}
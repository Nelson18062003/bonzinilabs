import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AdjustmentType = 'credit' | 'debit';

export interface AdjustWalletData {
  userId: string;
  amount: number;
  adjustmentType: AdjustmentType;
  reason: string;
}

export function useAdminAdjustWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AdjustWalletData) => {
      const { data: result, error } = await supabase.rpc('admin_adjust_wallet', {
        p_user_id: data.userId,
        p_amount: data.amount,
        p_adjustment_type: data.adjustmentType,
        p_reason: data.reason,
      });

      if (error) throw error;

      const typedResult = result as { 
        success: boolean; 
        error?: string; 
        new_balance?: number;
        amount?: number;
        type?: string;
      };

      if (!typedResult.success) {
        throw new Error(typedResult.error || 'Ajustement échoué');
      }

      return typedResult;
    },
    onSuccess: (data, variables) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['all-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-operations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-client', variables.userId] });
      
      const typeLabel = variables.adjustmentType === 'credit' ? 'Crédit' : 'Débit';
      toast.success(`${typeLabel} effectué avec succès`, {
        description: `Nouveau solde: ${data.new_balance?.toLocaleString('fr-FR')} XAF`,
      });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

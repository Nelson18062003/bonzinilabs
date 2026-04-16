import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import i18n from '@/i18n';

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
      const { data: result, error } = await supabaseAdmin.rpc('admin_adjust_wallet', {
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
        throw new Error(typedResult.error || i18n.t('hooks.adjustWallet.error', { ns: 'common', defaultValue: 'Ajustement échoué' }));
      }

      return typedResult;
    },
    onSuccess: (data, variables) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['all-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-operations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-client', variables.userId] });
      
      const typeLabel = variables.adjustmentType === 'credit'
        ? i18n.t('hooks.adjustWallet.credit', { ns: 'common', defaultValue: 'Crédit' })
        : i18n.t('hooks.adjustWallet.debit', { ns: 'common', defaultValue: 'Débit' });
      toast.success(i18n.t('hooks.adjustWallet.success', { ns: 'common', defaultValue: `${typeLabel} effectué avec succès`, type: typeLabel }), {
        description: i18n.t('hooks.adjustWallet.newBalance', { ns: 'common', defaultValue: `Nouveau solde: ${formatCurrency(data.new_balance || 0)}`, balance: formatCurrency(data.new_balance || 0) }),
      });
    },
    onError: (error) => {
      toast.error(i18n.t('hooks.adjustWallet.errorPrefix', { ns: 'common', defaultValue: `Erreur: ${error.message}`, message: error.message }));
    },
  });
}

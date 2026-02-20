import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScanCashPaymentResult {
  success: boolean;
  error?: string;
  payment?: {
    id: string;
    reference: string;
    amount_rmb: number;
    amount_xaf: number;
    status: string;
    method: string;
    cash_beneficiary_type: string | null;
    cash_beneficiary_first_name: string | null;
    cash_beneficiary_last_name: string | null;
    cash_beneficiary_phone: string | null;
    beneficiary_name: string | null;
    user_id: string;
  };
}

interface ConfirmCashPaymentResult {
  success: boolean;
  error?: string;
}

/**
 * Agent-specific scan mutation using supabaseAdmin.
 * Must NOT use `supabase` (client auth) — agent sessions use supabaseAdmin.
 */
export function useAgentScanCashPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string): Promise<ScanCashPaymentResult> => {
      const { data, error } = await supabaseAdmin.rpc('scan_cash_payment', {
        p_payment_id: paymentId,
      });

      if (error) throw error;
      return data as unknown as ScanCashPaymentResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['agent-cash-payments'] });
        queryClient.invalidateQueries({ queryKey: ['agent-cash-payment'] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Agent-specific confirm mutation using supabaseAdmin.
 * Uploads signature to storage then calls the RPC.
 */
export function useAgentConfirmCashPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      signatureDataUrl,
      signedByName,
    }: {
      paymentId: string;
      signatureDataUrl: string;
      signedByName: string;
    }): Promise<ConfirmCashPaymentResult> => {
      // Upload signature to storage
      const signatureBlob = await fetch(signatureDataUrl).then(r => r.blob());
      const fileName = `${paymentId}/${Date.now()}_signature.png`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('cash-signatures')
        .upload(fileName, signatureBlob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('cash-signatures')
        .getPublicUrl(fileName);

      // Confirm the payment
      const { data, error } = await supabaseAdmin.rpc('confirm_cash_payment', {
        p_payment_id: paymentId,
        p_signature_url: publicUrl,
        p_signed_by_name: signedByName,
      });

      if (error) throw error;
      return data as unknown as ConfirmCashPaymentResult;
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['agent-cash-payments'] });
        queryClient.invalidateQueries({ queryKey: ['agent-cash-payment', variables.paymentId] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

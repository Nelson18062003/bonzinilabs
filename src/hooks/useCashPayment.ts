import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

export function useScanCashPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string): Promise<ScanCashPaymentResult> => {
      const { data, error } = await supabase.rpc('scan_cash_payment', {
        p_payment_id: paymentId,
      });

      if (error) throw error;
      return data as unknown as ScanCashPaymentResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
        toast.success('QR Code scanné avec succès');
      } else {
        toast.error(result.error || 'Erreur lors du scan');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useConfirmCashPayment() {
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
      const fileName = `cash-signatures/${paymentId}/${Date.now()}_signature.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('cash-signatures')
        .upload(fileName, signatureBlob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cash-signatures')
        .getPublicUrl(fileName);

      // Confirm the payment
      const { data, error } = await supabase.rpc('confirm_cash_payment', {
        p_payment_id: paymentId,
        p_signature_url: publicUrl,
        p_signed_by_name: signedByName,
      });

      if (error) throw error;
      return data as unknown as ConfirmCashPaymentResult;
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
        queryClient.invalidateQueries({ queryKey: ['admin-payment', variables.paymentId] });
        queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
        toast.success('Paiement cash confirmé avec succès');
      } else {
        toast.error(result.error || 'Erreur lors de la confirmation');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Parse QR code data
export function parseCashQRCode(qrData: string): { paymentId: string; isValid: boolean } {
  try {
    const parsed = JSON.parse(qrData);
    if (parsed.type === 'BONZINI_CASH_PAYMENT' && parsed.id) {
      return { paymentId: parsed.id, isValid: true };
    }
    return { paymentId: '', isValid: false };
  } catch {
    return { paymentId: '', isValid: false };
  }
}

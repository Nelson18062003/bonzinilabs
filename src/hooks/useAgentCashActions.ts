import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateActionBadges } from '@/hooks/useAdminNotifications';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { rpcArgs } from '@/integrations/supabase/rpcArgs';
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
    mutationFn: async ({ paymentId, token }: { paymentId: string; token: string }): Promise<ScanCashPaymentResult> => {
      // Le jeton vient du QR du client (parseCashQRCode) : sans lui, le serveur refuse.
      const { data, error } = await supabaseAdmin.rpc('scan_cash_payment', {
        p_payment_id: paymentId,
        p_qr_token: token,
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
 * Uploads the signature to storage (« <paymentId>/… ») then calls the RPC
 * with the object PATH: the server checks the file exists, was uploaded by
 * this account, for this payment, after the scan.
 * `signedByName` is the name the signer DECLARES (not the expected one).
 * Administration (canProcessPayments) : signature, nom et scan facultatifs
 * (décision du propriétaire, 31/10/2026) — sans signature, rien n'est déposé.
 */
export function useAgentConfirmCashPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      signatureDataUrl,
      signedByName,
      signerIdNumber,
    }: {
      paymentId: string;
      signatureDataUrl?: string | null;
      signedByName?: string | null;
      signerIdNumber?: string | null;
    }): Promise<ConfirmCashPaymentResult> => {
      // Upload signature to storage (s'il y en a une)
      let fileName = '';
      if (signatureDataUrl) {
        const signatureBlob = await fetch(signatureDataUrl).then(r => r.blob());
        fileName = `${paymentId}/${Date.now()}_signature.png`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('cash-signatures')
          .upload(fileName, signatureBlob, { contentType: 'image/png' });

        if (uploadError) throw uploadError;
      }

      // Confirm the payment ('' = sans signature / sans nom : le serveur le lit comme absent)
      const { data, error } = await supabaseAdmin.rpc('confirm_cash_payment', rpcArgs<'confirm_cash_payment'>({
        p_payment_id: paymentId,
        p_signature_path: fileName,
        p_signed_by_name: signedByName?.trim() ?? '',
        p_signer_id_number: signerIdNumber?.trim() || null,
      }));

      if (error) throw error;
      return data as unknown as ConfirmCashPaymentResult;
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['agent-cash-payments'] });
        queryClient.invalidateQueries({ queryKey: ['agent-cash-payment', variables.paymentId] });
        // L'écran admin du même paiement (signature, statut) et les badges.
        queryClient.invalidateQueries({ queryKey: ['admin-payment', variables.paymentId] });
        queryClient.invalidateQueries({ queryKey: ['admin-payment-timeline', variables.paymentId] });
        queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
        invalidateActionBadges(queryClient);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

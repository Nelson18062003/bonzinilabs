import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import i18n from '@/i18n';

export interface AdminCreatePaymentData {
  user_id: string;
  amount_xaf: number;
  amount_rmb: number;
  exchange_rate: number;
  method: 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
  beneficiary_name?: string;
  beneficiary_phone?: string;
  beneficiary_email?: string;
  beneficiary_qr_code_url?: string;
  beneficiary_bank_name?: string;
  beneficiary_bank_account?: string;
  beneficiary_bank_extra?: string;
  beneficiary_notes?: string;
  beneficiary_identifier?: string;
  beneficiary_identifier_type?: 'qr' | 'id' | 'email' | 'phone';
  client_visible_comment?: string;
  desired_date?: Date;
  qr_code_files?: File[];
  // Beneficiary system fields
  beneficiary_id?: string;
  beneficiary_details?: Record<string, unknown>;
  rate_is_custom?: boolean;
}

// Create payment for a client (admin only)
export function useAdminCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AdminCreatePaymentData) => {
      // First upload QR codes if provided
      let qrCodeUrl = data.beneficiary_qr_code_url;
      
      if (data.qr_code_files && data.qr_code_files.length > 0) {
        // Upload the first QR code as the main beneficiary QR
        const compressed = await compressImage(data.qr_code_files[0]);
        const filePath = `qr-codes/${data.user_id}/${Date.now()}_${compressed.name}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, compressed);

        if (uploadError) throw uploadError;

        // Store the file path for later signed URL generation
        qrCodeUrl = `payment-proofs/${filePath}`;
      }

      // Call the RPC function
      const { data: result, error } = await supabaseAdmin.rpc('create_admin_payment', {
        p_user_id: data.user_id,
        p_amount_xaf: data.amount_xaf,
        p_amount_rmb: data.amount_rmb,
        p_exchange_rate: data.exchange_rate,
        p_method: data.method,
        p_beneficiary_name: data.beneficiary_name || undefined,
        p_beneficiary_phone: data.beneficiary_phone || undefined,
        p_beneficiary_email: data.beneficiary_email || undefined,
        p_beneficiary_qr_code_url: qrCodeUrl || undefined,
        p_beneficiary_bank_name: data.beneficiary_bank_name || undefined,
        p_beneficiary_bank_account: data.beneficiary_bank_account || undefined,
        p_beneficiary_notes: data.beneficiary_notes || undefined,
        p_client_visible_comment: data.client_visible_comment || undefined,
        p_desired_date: data.desired_date?.toISOString() || undefined,
      });

      if (error) throw error;

      const response = result as {
        success: boolean;
        error?: string;
        payment_id?: string;
        reference?: string;
        new_balance?: number
      };

      if (!response.success) {
        throw new Error(response.error || i18n.t('hooks.createPayment.error', { ns: 'common', defaultValue: 'Erreur lors de la création du paiement' }));
      }

      // Update beneficiary system fields separately (migration pending)
      const hasExtendedFields = !!(
        data.beneficiary_id ||
        data.beneficiary_details ||
        data.rate_is_custom ||
        data.beneficiary_identifier ||
        data.beneficiary_identifier_type ||
        data.beneficiary_bank_extra
      );

      if (response.payment_id && hasExtendedFields) {
        await supabaseAdmin
          .from('payments')
          .update({
            beneficiary_id: data.beneficiary_id || null,
            beneficiary_details: data.beneficiary_details || null,
            rate_is_custom: data.rate_is_custom ?? false,
            beneficiary_identifier: data.beneficiary_identifier || null,
            beneficiary_identifier_type: data.beneficiary_identifier_type || null,
            beneficiary_bank_extra: data.beneficiary_bank_extra || null,
          })
          .eq('id', response.payment_id);
      }

      // Upload additional QR codes as payment proofs
      if (data.qr_code_files && data.qr_code_files.length > 1 && response.payment_id) {
        const { data: { user } } = await supabaseAdmin.auth.getUser();
        
        for (let i = 1; i < data.qr_code_files.length; i++) {
          const compressed = await compressImage(data.qr_code_files[i]);
          const filePath = `admin/${response.payment_id}/${Date.now()}_${compressed.name}`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from('payment-proofs')
            .upload(filePath, compressed);

          if (!uploadError) {
            const storedPath = `payment-proofs/${filePath}`;

            await supabaseAdmin.from('payment_proofs').insert([{
              payment_id: response.payment_id!,
              uploaded_by: user?.id || '',
              uploaded_by_type: 'admin',
              file_name: compressed.name,
              file_url: storedPath,
              file_type: compressed.type,
              description: 'QR Code de paiement',
            }]);
          }
        }
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['all-wallets'] });
      toast.success(i18n.t('hooks.createPayment.success', { ns: 'common', defaultValue: 'Paiement créé avec succès' }));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/** @deprecated Use useCancelPayment instead — delete erases ledger history */
export function useDeletePayment() {
  return useCancelPayment();
}

export function useCancelPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabaseAdmin.rpc('cancel_payment', {
        p_payment_id: paymentId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || i18n.t('hooks.cancelPayment.error', { ns: 'common', defaultValue: "Erreur lors de l'annulation" }));
      }

      return result;
    },
    onSuccess: (_data, paymentId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment', paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-timeline', paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', paymentId] });
      queryClient.invalidateQueries({ queryKey: ['all-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['client-ledger'] });
      toast.success(i18n.t('hooks.cancelPayment.success', { ns: 'common', defaultValue: 'Paiement annulé' }));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Delete a payment proof (admin only). The RPC also returns the parent
// payment_id so we can invalidate the right cache keys without forcing the
// caller to remember and pass it.
export function useDeletePaymentProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proofId: string) => {
      const { data, error } = await supabaseAdmin.rpc('delete_payment_proof', {
        p_proof_id: proofId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; payment_id?: string };
      if (!result.success) {
        throw new Error(result.error || i18n.t('hooks.deleteProof.error', { ns: 'common', defaultValue: 'Erreur lors de la suppression' }));
      }

      return result;
    },
    onSuccess: (result) => {
      const paymentId = result.payment_id;
      // The admin-side query is keyed `['admin-payment-proofs', paymentId]`
      // (usePayments.ts:719). The previous `['payment-proofs']` invalidation
      // missed it silently and produced the "have to reload" symptom.
      queryClient.invalidateQueries({ queryKey: ['payment-proofs', paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-proofs', paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-timeline', paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment', paymentId] });
      toast.success(i18n.t('hooks.deleteProof.success', { ns: 'common', defaultValue: 'Preuve supprimée' }));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Update beneficiary info for a payment (admin)
export function useAdminUpdateBeneficiaryInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      paymentId, 
      beneficiaryInfo,
      qrCodeFile 
    }: { 
      paymentId: string; 
      beneficiaryInfo: {
        beneficiary_name?: string;
        beneficiary_phone?: string;
        beneficiary_email?: string;
        beneficiary_qr_code_url?: string | null;
        beneficiary_bank_name?: string;
        beneficiary_bank_account?: string;
        beneficiary_bank_extra?: string;
        beneficiary_notes?: string;
        beneficiary_identifier?: string;
        beneficiary_identifier_type?: 'qr' | 'id' | 'email' | 'phone' | null;
      };
      qrCodeFile?: File;
    }) => {
      let qrCodeUrl: string | null | undefined = beneficiaryInfo.beneficiary_qr_code_url;

      // Upload QR code if provided
      if (qrCodeFile) {
        const compressed = await compressImage(qrCodeFile);
        const filePath = `qr-codes/${paymentId}/${Date.now()}_${compressed.name}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, compressed);

        if (uploadError) throw uploadError;

        qrCodeUrl = `payment-proofs/${filePath}`;
      }

      // Explicit QR deletion: caller passed `null` and no new file → clear the
      // column first. The RPC uses COALESCE semantics (NULL = no change) so
      // a "clear" operation cannot go through the RPC alone.
      const isExplicitQrDeletion =
        !qrCodeFile && beneficiaryInfo.beneficiary_qr_code_url === null;
      if (isExplicitQrDeletion) {
        const { error: clearError } = await supabaseAdmin
          .from('payments')
          .update({ beneficiary_qr_code_url: null })
          .eq('id', paymentId);
        if (clearError) throw clearError;
      }

      // Everything else (fields + status + timeline) goes through the RPC so
      // the status transition and the timeline entries stay server-side and
      // atomic. If the extended RPC (20260421000002) isn't deployed yet we
      // fall back to a direct UPDATE so the admin edit keeps working.
      const rpcParams: Record<string, unknown> = {
        p_payment_id: paymentId,
        p_beneficiary_name:            beneficiaryInfo.beneficiary_name || undefined,
        p_beneficiary_phone:           beneficiaryInfo.beneficiary_phone || undefined,
        p_beneficiary_email:           beneficiaryInfo.beneficiary_email || undefined,
        p_beneficiary_qr_code_url:     qrCodeUrl || undefined,
        p_beneficiary_bank_name:       beneficiaryInfo.beneficiary_bank_name || undefined,
        p_beneficiary_bank_account:    beneficiaryInfo.beneficiary_bank_account || undefined,
        p_beneficiary_notes:           beneficiaryInfo.beneficiary_notes || undefined,
        p_beneficiary_identifier:      beneficiaryInfo.beneficiary_identifier || undefined,
        p_beneficiary_identifier_type: beneficiaryInfo.beneficiary_identifier_type || undefined,
        p_beneficiary_bank_extra:      beneficiaryInfo.beneficiary_bank_extra || undefined,
      };

      const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
        'admin_update_payment_beneficiary',
        rpcParams,
      );

      if (rpcError) {
        // Only fall back when the RPC truly cannot be resolved by PostgREST
        // (function not found / unknown signature). Real errors raised by
        // the RPC body — including 42804 datatype_mismatch — must surface.
        const missing =
          rpcError.code === '42883' ||
          rpcError.code === 'PGRST202' ||
          rpcError.code === 'PGRST203' ||
          /function .* does not exist|could not find the function|no function matches/i.test(rpcError.message || '');
        if (!missing) throw rpcError;

        // Fallback: RPC not deployed yet — write columns directly + compute
        // status client-side like the pre-R2 hook did. Timeline is best-effort.
        const directUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of [
          'beneficiary_name','beneficiary_phone','beneficiary_email',
          'beneficiary_bank_name','beneficiary_bank_account','beneficiary_notes',
          'beneficiary_bank_extra','beneficiary_identifier','beneficiary_identifier_type',
        ] as const) {
          const v = (beneficiaryInfo as Record<string, unknown>)[k];
          if (v !== undefined) directUpdate[k] = v;
        }
        if (qrCodeFile || beneficiaryInfo.beneficiary_qr_code_url !== undefined) {
          directUpdate.beneficiary_qr_code_url = qrCodeUrl;
        }

        // Skip columns that still don't exist on the remote (migration 20260421000001 not deployed)
        const tryUpdate = async (payload: Record<string, unknown>) =>
          supabaseAdmin.from('payments').update(payload).eq('id', paymentId);

        let res = await tryUpdate(directUpdate);
        if (res.error && (res.error.code === '42703' || /column .* does not exist/i.test(res.error.message || ''))) {
          delete directUpdate.beneficiary_bank_extra;
          delete directUpdate.beneficiary_identifier;
          delete directUpdate.beneficiary_identifier_type;
          res = await tryUpdate(directUpdate);
        }
        if (res.error) throw res.error;
        return;
      }

      const result = rpcResult as { success: boolean; error?: string; new_status?: string };
      if (!result.success) {
        throw new Error(
          result.error ||
            i18n.t('hooks.adminUpdateBeneficiary.error', {
              ns: 'common',
              defaultValue: "Erreur lors de la mise à jour",
            }),
        );
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      toast.success(i18n.t('hooks.adminUpdateBeneficiary.infoUpdated', { ns: 'common', defaultValue: 'Informations mises à jour' }));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

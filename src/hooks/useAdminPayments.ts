import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  beneficiary_notes?: string;
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
        const file = data.qr_code_files[0];
        const filePath = `qr-codes/${data.user_id}/${Date.now()}_${file.name}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, file);

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
        // Beneficiary system fields
        p_beneficiary_id: data.beneficiary_id || undefined,
        p_beneficiary_details: data.beneficiary_details || undefined,
        p_rate_is_custom: data.rate_is_custom ?? false,
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
        throw new Error(response.error || 'Erreur lors de la création du paiement');
      }

      // Upload additional QR codes as payment proofs
      if (data.qr_code_files && data.qr_code_files.length > 1 && response.payment_id) {
        const { data: { user } } = await supabaseAdmin.auth.getUser();
        
        for (let i = 1; i < data.qr_code_files.length; i++) {
          const file = data.qr_code_files[i];
          const filePath = `admin/${response.payment_id}/${Date.now()}_${file.name}`;
          
          const { error: uploadError } = await supabaseAdmin.storage
            .from('payment-proofs')
            .upload(filePath, file);

          if (!uploadError) {
            // Store the file path for later signed URL generation
            const storedPath = `payment-proofs/${filePath}`;

            await supabaseAdmin.from('payment_proofs').insert([{
              payment_id: response.payment_id!,
              uploaded_by: user?.id || '',
              uploaded_by_type: 'admin',
              file_name: file.name,
              file_url: storedPath,
              file_type: file.type,
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
      toast.success('Paiement créé avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Delete a payment (admin only)
export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabaseAdmin.rpc('delete_payment', {
        p_payment_id: paymentId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la suppression');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['all-wallets'] });
      toast.success('Paiement supprimé');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Delete a payment proof (admin only)
export function useDeletePaymentProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proofId: string) => {
      const { data, error } = await supabaseAdmin.rpc('delete_payment_proof', {
        p_proof_id: proofId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la suppression');
      }

      return result;
    },
    onSuccess: (_) => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs'] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline'] });
      toast.success('Preuve supprimée');
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
        beneficiary_notes?: string;
      };
      qrCodeFile?: File;
    }) => {
      let qrCodeUrl: string | null | undefined = beneficiaryInfo.beneficiary_qr_code_url;
      
      // Upload QR code if provided
      if (qrCodeFile) {
        const filePath = `qr-codes/${paymentId}/${Date.now()}_${qrCodeFile.name}`;
        
        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, qrCodeFile);

        if (uploadError) throw uploadError;

        // Store the file path for later signed URL generation
        qrCodeUrl = `payment-proofs/${filePath}`;
      }

      // Build update data - only include qr_code_url if it's explicitly set (including null for deletion)
      const updateData: Record<string, unknown> = {
        ...beneficiaryInfo,
        updated_at: new Date().toISOString(),
      };

      // Only update QR code URL if explicitly provided (including null for deletion) or if file was uploaded
      if (qrCodeFile || beneficiaryInfo.beneficiary_qr_code_url !== undefined) {
        updateData.beneficiary_qr_code_url = qrCodeUrl;
      }

      // Determine if we have sufficient info after this update
      // Fetch current payment to merge with updates
      const { data: currentPayment } = await supabaseAdmin
        .from('payments')
        .select('beneficiary_name, beneficiary_bank_account, beneficiary_qr_code_url')
        .eq('id', paymentId)
        .single();

      const finalQrCode = qrCodeFile ? qrCodeUrl : (beneficiaryInfo.beneficiary_qr_code_url !== undefined ? beneficiaryInfo.beneficiary_qr_code_url : currentPayment?.beneficiary_qr_code_url);
      const finalName = beneficiaryInfo.beneficiary_name !== undefined ? beneficiaryInfo.beneficiary_name : currentPayment?.beneficiary_name;
      const finalBankAccount = beneficiaryInfo.beneficiary_bank_account !== undefined ? beneficiaryInfo.beneficiary_bank_account : currentPayment?.beneficiary_bank_account;
      
      const hasInfo = finalQrCode || finalName || finalBankAccount;

      updateData.status = hasInfo ? 'ready_for_payment' : 'waiting_beneficiary_info';

      const { error } = await supabaseAdmin
        .from('payments')
        .update(updateData)
        .eq('id', paymentId);

      if (error) throw error;

      // Add timeline event
      if (hasInfo) {
        const { data: { user } } = await supabaseAdmin.auth.getUser();
        await supabaseAdmin.from('payment_timeline_events').insert({
          payment_id: paymentId,
          event_type: 'info_provided',
          description: 'Informations du bénéficiaire ajoutées par l\'admin',
          performed_by: user?.id,
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      toast.success('Informations mises à jour');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

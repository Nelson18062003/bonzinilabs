import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
        const fileName = `qr-codes/${data.user_id}/${Date.now()}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(fileName);

        qrCodeUrl = publicUrl;
      }

      // Call the RPC function
      const { data: result, error } = await supabase.rpc('create_admin_payment', {
        p_user_id: data.user_id,
        p_amount_xaf: data.amount_xaf,
        p_amount_rmb: data.amount_rmb,
        p_exchange_rate: data.exchange_rate,
        p_method: data.method,
        p_beneficiary_name: data.beneficiary_name || null,
        p_beneficiary_phone: data.beneficiary_phone || null,
        p_beneficiary_email: data.beneficiary_email || null,
        p_beneficiary_qr_code_url: qrCodeUrl || null,
        p_beneficiary_bank_name: data.beneficiary_bank_name || null,
        p_beneficiary_bank_account: data.beneficiary_bank_account || null,
        p_beneficiary_notes: data.beneficiary_notes || null,
        p_client_visible_comment: data.client_visible_comment || null,
        p_desired_date: data.desired_date?.toISOString() || null,
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
        const { data: { user } } = await supabase.auth.getUser();
        
        for (let i = 1; i < data.qr_code_files.length; i++) {
          const file = data.qr_code_files[i];
          const fileName = `admin/${response.payment_id}/${Date.now()}_${file.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(fileName, file);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('payment-proofs')
              .getPublicUrl(fileName);

            await supabase.from('payment_proofs').insert({
              payment_id: response.payment_id,
              uploaded_by: user?.id,
              uploaded_by_type: 'admin',
              file_name: file.name,
              file_url: publicUrl,
              file_type: file.type,
              description: 'QR Code de paiement',
            });
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
      const { data, error } = await supabase.rpc('delete_payment', {
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
      const { data, error } = await supabase.rpc('delete_payment_proof', {
        p_proof_id: proofId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la suppression');
      }

      return result;
    },
    onSuccess: (_, proofId) => {
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
        beneficiary_qr_code_url?: string;
        beneficiary_bank_name?: string;
        beneficiary_bank_account?: string;
        beneficiary_notes?: string;
      };
      qrCodeFile?: File;
    }) => {
      let qrCodeUrl = beneficiaryInfo.beneficiary_qr_code_url;
      
      // Upload QR code if provided
      if (qrCodeFile) {
        const fileName = `qr-codes/${paymentId}/${Date.now()}_${qrCodeFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, qrCodeFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(fileName);

        qrCodeUrl = publicUrl;
      }

      // Determine if we have sufficient info
      const hasInfo = qrCodeUrl || 
                      beneficiaryInfo.beneficiary_name || 
                      beneficiaryInfo.beneficiary_bank_account;

      const { error } = await supabase
        .from('payments')
        .update({
          ...beneficiaryInfo,
          beneficiary_qr_code_url: qrCodeUrl,
          status: hasInfo ? 'ready_for_payment' : 'waiting_beneficiary_info',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (error) throw error;

      // Add timeline event
      if (hasInfo) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('payment_timeline_events').insert({
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

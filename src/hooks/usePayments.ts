import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { validateUploadFile } from '@/lib/utils';

// Cache configuration for performance
const STALE_TIME = 30 * 1000; // 30 seconds
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

export type PaymentStatus = 'created' | 'waiting_beneficiary_info' | 'ready_for_payment' | 'processing' | 'completed' | 'rejected' | 'cash_pending' | 'cash_scanned';

export interface Payment {
  id: string;
  user_id: string;
  reference: string;
  amount_xaf: number;
  amount_rmb: number;
  exchange_rate: number;
  method: 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
  status: PaymentStatus;
  beneficiary_name: string | null;
  beneficiary_phone: string | null;
  beneficiary_email: string | null;
  beneficiary_qr_code_url: string | null;
  beneficiary_bank_name: string | null;
  beneficiary_bank_account: string | null;
  beneficiary_notes: string | null;
  cash_qr_code: string | null;
  // Cash-specific fields
  cash_beneficiary_type: 'self' | 'other' | null;
  cash_beneficiary_first_name: string | null;
  cash_beneficiary_last_name: string | null;
  cash_beneficiary_phone: string | null;
  cash_signature_url: string | null;
  cash_signature_timestamp: string | null;
  cash_signed_by_name: string | null;
  cash_scanned_at: string | null;
  cash_paid_at: string | null;
  // Standard fields
  processed_by: string | null;
  processed_at: string | null;
  rejection_reason: string | null;
  admin_comment: string | null;
  client_visible_comment: string | null;
  balance_before: number;
  balance_after: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentProof {
  id: string;
  payment_id: string;
  uploaded_by: string;
  uploaded_by_type: 'client' | 'admin';
  file_name: string;
  file_url: string;
  file_type: string | null;
  description: string | null;
  created_at: string;
}

export interface PaymentTimelineEvent {
  id: string;
  payment_id: string;
  event_type: string;
  description: string;
  performed_by: string | null;
  created_at: string;
}

export interface CreatePaymentData {
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
  // Cash-specific fields
  cash_beneficiary_type?: 'self' | 'other';
  cash_beneficiary_first_name?: string;
  cash_beneficiary_last_name?: string;
  cash_beneficiary_phone?: string;
}

// Client hooks
export function useMyPayments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-payments', user?.id],
    staleTime: 10 * 1000, // 10 seconds for user's own data
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!user?.id,
  });
}

export function usePaymentDetail(paymentId: string | undefined) {
  return useQuery({
    queryKey: ['payment', paymentId],
    staleTime: 10 * 1000,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (error) throw error;

      const payment = data as Payment;

      // Generate signed URL for beneficiary QR code if stored as path
      if (payment.beneficiary_qr_code_url?.startsWith('payment-proofs/')) {
        const storagePath = payment.beneficiary_qr_code_url.replace('payment-proofs/', '');
        const { data: signedData } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(storagePath, 3600); // 1 hour expiry

        payment.beneficiary_qr_code_url = signedData?.signedUrl || payment.beneficiary_qr_code_url;
      }

      return payment;
    },
    enabled: !!paymentId,
  });
}

export function usePaymentTimeline(paymentId: string | undefined) {
  return useQuery({
    queryKey: ['payment-timeline', paymentId],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_timeline_events')
        .select('*')
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as PaymentTimelineEvent[];
    },
    enabled: !!paymentId,
  });
}

export function usePaymentProofs(paymentId: string | undefined) {
  return useQuery({
    queryKey: ['payment-proofs', paymentId],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_proofs')
        .select('*')
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Generate signed URLs for all proofs
      const proofsWithSignedUrls = await Promise.all(
        (data as PaymentProof[]).map(async (proof) => {
          // Check if file_url is a storage path (starts with 'payment-proofs/')
          if (proof.file_url?.startsWith('payment-proofs/')) {
            const storagePath = proof.file_url.replace('payment-proofs/', '');
            const { data: signedData } = await supabase.storage
              .from('payment-proofs')
              .createSignedUrl(storagePath, 3600); // 1 hour expiry

            return {
              ...proof,
              file_url: signedData?.signedUrl || proof.file_url,
            };
          }
          return proof;
        })
      );

      return proofsWithSignedUrls;
    },
    enabled: !!paymentId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePaymentData) => {
      const { data: result, error } = await supabase.rpc('create_payment', {
        p_amount_xaf: data.amount_xaf,
        p_amount_rmb: data.amount_rmb,
        p_exchange_rate: data.exchange_rate,
        p_method: data.method,
        p_beneficiary_name: data.beneficiary_name || null,
        p_beneficiary_phone: data.beneficiary_phone || null,
        p_beneficiary_email: data.beneficiary_email || null,
        p_beneficiary_qr_code_url: data.beneficiary_qr_code_url || null,
        p_beneficiary_bank_name: data.beneficiary_bank_name || null,
        p_beneficiary_bank_account: data.beneficiary_bank_account || null,
        p_beneficiary_notes: data.beneficiary_notes || null,
        // Cash-specific fields
        p_cash_beneficiary_type: data.cash_beneficiary_type || null,
        p_cash_beneficiary_first_name: data.cash_beneficiary_first_name || null,
        p_cash_beneficiary_last_name: data.cash_beneficiary_last_name || null,
        p_cash_beneficiary_phone: data.cash_beneficiary_phone || null,
      });

      if (error) throw error;
      
      const response = result as { success: boolean; error?: string; payment_id?: string; reference?: string; new_balance?: number };
      
      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de la création du paiement');
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-payments'] });
      queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      toast.success('Paiement créé avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateBeneficiaryInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      beneficiaryInfo,
      paymentMethod
    }: {
      paymentId: string;
      beneficiaryInfo: Partial<Pick<Payment, 'beneficiary_name' | 'beneficiary_phone' | 'beneficiary_email' | 'beneficiary_qr_code_url' | 'beneficiary_bank_name' | 'beneficiary_bank_account' | 'beneficiary_notes'>>;
      paymentMethod?: Payment['method'];
    }) => {
      // Determine if we have sufficient info based on payment method
      let hasValidInfo = false;
      let infoDescription = 'Informations du bénéficiaire mises à jour';

      if (paymentMethod === 'alipay' || paymentMethod === 'wechat') {
        // For Alipay/WeChat: QR code OR (phone/email)
        const hasQr = !!beneficiaryInfo.beneficiary_qr_code_url;
        const hasContact = !!(beneficiaryInfo.beneficiary_phone || beneficiaryInfo.beneficiary_email);
        hasValidInfo = hasQr || hasContact;

        if (hasQr) {
          infoDescription = `QR Code ${paymentMethod === 'alipay' ? 'Alipay' : 'WeChat'} ajouté`;
        } else if (hasContact) {
          infoDescription = 'Coordonnées de paiement ajoutées';
        }
      } else if (paymentMethod === 'bank_transfer') {
        // For bank transfer: name + bank + account required
        hasValidInfo = !!(
          beneficiaryInfo.beneficiary_name &&
          beneficiaryInfo.beneficiary_bank_name &&
          beneficiaryInfo.beneficiary_bank_account
        );
        infoDescription = 'Coordonnées bancaires ajoutées';
      } else {
        // Fallback: any info is considered sufficient
        hasValidInfo = !!(
          beneficiaryInfo.beneficiary_qr_code_url ||
          beneficiaryInfo.beneficiary_name ||
          beneficiaryInfo.beneficiary_phone ||
          beneficiaryInfo.beneficiary_bank_account
        );
      }

      const { error } = await supabase
        .from('payments')
        .update({
          ...beneficiaryInfo,
          status: hasValidInfo ? 'ready_for_payment' : 'waiting_beneficiary_info',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (error) throw error;

      // Always add timeline event when beneficiary info is modified
      const userId = (await supabase.auth.getUser()).data.user?.id;
      await supabase.from('payment_timeline_events').insert({
        payment_id: paymentId,
        event_type: hasValidInfo ? 'info_provided' : 'info_updated',
        description: infoDescription,
        performed_by: userId,
      });

      return { hasValidInfo };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['my-payments'] });

      if (result.hasValidInfo) {
        toast.success('Informations enregistrées - Paiement prêt à être traité');
      } else {
        toast.info('Informations partiellement enregistrées');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUploadPaymentProof() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      paymentId, 
      file, 
      description 
    }: { 
      paymentId: string; 
      file: File; 
      description?: string 
    }) => {
      validateUploadFile(file);
      const filePath = `${paymentId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the file path for later signed URL generation
      const storedPath = `payment-proofs/${filePath}`;

      const { error } = await supabase.from('payment_proofs').insert({
        payment_id: paymentId,
        uploaded_by: user?.id,
        uploaded_by_type: 'client',
        file_name: file.name,
        file_url: storedPath,
        file_type: file.type,
        description,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs', variables.paymentId] });
      toast.success('Preuve téléchargée');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAdminUpdateBeneficiaryInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      beneficiaryInfo,
    }: {
      paymentId: string;
      beneficiaryInfo: Partial<Pick<Payment,
        | 'beneficiary_name'
        | 'beneficiary_phone'
        | 'beneficiary_email'
        | 'beneficiary_qr_code_url'
        | 'beneficiary_bank_name'
        | 'beneficiary_bank_account'
        | 'beneficiary_notes'
      >>;
    }) => {
      const { data: result, error } = await supabaseAdmin.rpc(
        'admin_update_payment_beneficiary' as never,
        {
          p_payment_id: paymentId,
          p_beneficiary_name: beneficiaryInfo.beneficiary_name ?? null,
          p_beneficiary_phone: beneficiaryInfo.beneficiary_phone ?? null,
          p_beneficiary_email: beneficiaryInfo.beneficiary_email ?? null,
          p_beneficiary_qr_code_url: beneficiaryInfo.beneficiary_qr_code_url ?? null,
          p_beneficiary_bank_name: beneficiaryInfo.beneficiary_bank_name ?? null,
          p_beneficiary_bank_account: beneficiaryInfo.beneficiary_bank_account ?? null,
          p_beneficiary_notes: beneficiaryInfo.beneficiary_notes ?? null,
        } as never
      );

      if (error) throw new Error(error.message);

      const rpcResult = result as { success: boolean; error?: string };
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'Erreur lors de la mise à jour');
      }

      return rpcResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      toast.success('Infos bénéficiaire mises à jour');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    },
  });
}

// Admin hooks
export function useAdminPayments() {
  return useQuery({
    queryKey: ['admin-payments'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: payments, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Fetch client info separately
      const userIds = [...new Set(payments?.map(p => p.user_id) || [])];
      const { data: clients } = await supabaseAdmin
        .from('clients')
        .select('user_id, first_name, last_name, phone, company_name')
        .in('user_id', userIds);

      const clientMap = new Map(clients?.map(c => [c.user_id, c]) || []);

      return payments?.map(payment => ({
        ...payment,
        profiles: clientMap.get(payment.user_id) || null,
      })) || [];
    },
  });
}

export function useAdminPaymentDetail(paymentId: string | undefined) {
  return useQuery({
    queryKey: ['admin-payment', paymentId],
    staleTime: 10 * 1000,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: payment, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (error) throw error;

      // Fetch client info
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('user_id, first_name, last_name, phone, company_name')
        .eq('user_id', payment.user_id)
        .maybeSingle();

      // Generate signed URL for beneficiary QR code if stored as path
      let beneficiaryQrUrl = payment.beneficiary_qr_code_url;
      if (beneficiaryQrUrl?.startsWith('payment-proofs/')) {
        const storagePath = beneficiaryQrUrl.replace('payment-proofs/', '');
        const { data: signedData } = await supabaseAdmin.storage
          .from('payment-proofs')
          .createSignedUrl(storagePath, 3600);
        beneficiaryQrUrl = signedData?.signedUrl || beneficiaryQrUrl;
      }

      return {
        ...payment,
        beneficiary_qr_code_url: beneficiaryQrUrl,
        profiles: client
      };
    },
    enabled: !!paymentId,
  });
}

export function useProcessPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      paymentId, 
      action, 
      comment 
    }: { 
      paymentId: string; 
      action: 'start_processing' | 'complete' | 'reject'; 
      comment?: string 
    }) => {
      const { data, error } = await supabaseAdmin.rpc('process_payment', {
        p_payment_id: paymentId,
        p_action: action,
        p_comment: comment || null,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors du traitement');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      
      const messages = {
        start_processing: 'Paiement en cours de traitement',
        complete: 'Paiement marqué comme effectué',
        reject: 'Paiement refusé',
      };
      toast.success(messages[variables.action]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAdminUploadPaymentProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      paymentId, 
      file, 
      description 
    }: { 
      paymentId: string; 
      file: File; 
      description?: string 
    }) => {
      const filePath = `admin/${paymentId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('payment-proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the file path for later signed URL generation
      const storedPath = `payment-proofs/${filePath}`;

      const { data: { user } } = await supabaseAdmin.auth.getUser();

      const { error } = await supabaseAdmin.from('payment_proofs').insert({
        payment_id: paymentId,
        uploaded_by: user?.id,
        uploaded_by_type: 'admin',
        file_name: file.name,
        file_url: storedPath,
        file_type: file.type,
        description,
      });

      if (error) throw error;

      // Add timeline event
      await supabaseAdmin.from('payment_timeline_events').insert({
        payment_id: paymentId,
        event_type: 'proof_uploaded',
        description: 'Preuve de paiement ajoutée par Bonzini',
        performed_by: user?.id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-proofs', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-timeline', variables.paymentId] });
      toast.success('Preuve téléchargée');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Admin-specific query hooks (use supabaseAdmin for proper RLS auth)

export function useAdminPaymentProofs(paymentId: string | undefined) {
  return useQuery({
    queryKey: ['admin-payment-proofs', paymentId],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('payment_proofs')
        .select('*')
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Generate signed URLs for all proofs
      const proofsWithSignedUrls = await Promise.all(
        (data as PaymentProof[]).map(async (proof) => {
          if (proof.file_url?.startsWith('payment-proofs/')) {
            const storagePath = proof.file_url.replace('payment-proofs/', '');
            const { data: signedData } = await supabaseAdmin.storage
              .from('payment-proofs')
              .createSignedUrl(storagePath, 3600);
            return { ...proof, file_url: signedData?.signedUrl || proof.file_url };
          }
          return proof;
        })
      );

      return proofsWithSignedUrls;
    },
    enabled: !!paymentId,
  });
}

export function useAdminPaymentTimeline(paymentId: string | undefined) {
  return useQuery({
    queryKey: ['admin-payment-timeline', paymentId],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('payment_timeline_events')
        .select('*')
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as PaymentTimelineEvent[];
    },
    enabled: !!paymentId,
  });
}

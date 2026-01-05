import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
      return data as Payment;
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
      return data as PaymentProof[];
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
      beneficiaryInfo 
    }: { 
      paymentId: string; 
      beneficiaryInfo: Partial<Pick<Payment, 'beneficiary_name' | 'beneficiary_phone' | 'beneficiary_email' | 'beneficiary_qr_code_url' | 'beneficiary_bank_name' | 'beneficiary_bank_account' | 'beneficiary_notes'>> 
    }) => {
      // Determine if we have sufficient info
      const hasInfo = beneficiaryInfo.beneficiary_qr_code_url || 
                      beneficiaryInfo.beneficiary_name || 
                      beneficiaryInfo.beneficiary_bank_account;

      const { error } = await supabase
        .from('payments')
        .update({
          ...beneficiaryInfo,
          status: hasInfo ? 'ready_for_payment' : 'waiting_beneficiary_info',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (error) throw error;

      // Add timeline event
      if (hasInfo) {
        await supabase.from('payment_timeline_events').insert({
          payment_id: paymentId,
          event_type: 'info_provided',
          description: 'Informations du bénéficiaire ajoutées',
          performed_by: (await supabase.auth.getUser()).data.user?.id,
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['my-payments'] });
      toast.success('Informations mises à jour');
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
      const fileName = `${paymentId}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName);

      const { error } = await supabase.from('payment_proofs').insert({
        payment_id: paymentId,
        uploaded_by: user?.id,
        uploaded_by_type: 'client',
        file_name: file.name,
        file_url: publicUrl,
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

// Admin hooks
export function useAdminPayments() {
  return useQuery({
    queryKey: ['admin-payments'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = [...new Set(payments?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone, company_name')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return payments?.map(payment => ({
        ...payment,
        profiles: profileMap.get(payment.user_id) || null,
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
      const { data: payment, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (error) throw error;
      
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone, company_name')
        .eq('user_id', payment.user_id)
        .single();

      return { ...payment, profiles: profile };
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
      const { data, error } = await supabase.rpc('process_payment', {
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
      const fileName = `admin/${paymentId}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(fileName);

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('payment_proofs').insert({
        payment_id: paymentId,
        uploaded_by: user?.id,
        uploaded_by_type: 'admin',
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        description,
      });

      if (error) throw error;

      // Add timeline event
      await supabase.from('payment_timeline_events').insert({
        payment_id: paymentId,
        event_type: 'proof_uploaded',
        description: 'Preuve de paiement ajoutée par Bonzini',
        performed_by: user?.id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      toast.success('Preuve téléchargée');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Deposit {
  id: string;
  user_id: string;
  reference: string;
  amount_xaf: number;
  method: 'bank_transfer' | 'bank_cash' | 'agency_cash' | 'om_transfer' | 'om_withdrawal' | 'mtn_transfer' | 'mtn_withdrawal' | 'wave';
  bank_name: string | null;
  agency_name: string | null;
  client_phone: string | null;
  status: 'created' | 'awaiting_proof' | 'proof_submitted' | 'admin_review' | 'validated' | 'rejected';
  admin_comment: string | null;
  rejection_reason: string | null;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepositWithProfile extends Deposit {
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  } | null;
}

export interface DepositProof {
  id: string;
  deposit_id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  uploaded_at: string;
}

export interface DepositTimelineEvent {
  id: string;
  deposit_id: string;
  event_type: string;
  description: string;
  performed_by: string | null;
  created_at: string;
}

// Fetch all deposits for admin
export function useAdminDeposits() {
  return useQuery({
    queryKey: ['admin-deposits'],
    queryFn: async () => {
      // First get deposits
      const { data: deposits, error: depositsError } = await supabase
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false });

      if (depositsError) throw depositsError;
      if (!deposits) return [];

      // Get unique user IDs
      const userIds = [...new Set(deposits.map(d => d.user_id))];

      // Fetch profiles for those users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Map profiles by user_id
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Combine deposits with profiles
      return deposits.map(deposit => ({
        ...deposit,
        profiles: profileMap.get(deposit.user_id) || null,
      })) as DepositWithProfile[];
    },
  });
}

// Fetch single deposit with details
export function useDepositDetail(depositId: string | undefined) {
  return useQuery({
    queryKey: ['deposit', depositId],
    queryFn: async () => {
      if (!depositId) return null;

      const { data: deposit, error: depositError } = await supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .maybeSingle();

      if (depositError) throw depositError;
      if (!deposit) return null;

      // Fetch profile for this user
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', deposit.user_id)
        .maybeSingle();

      if (profileError) throw profileError;

      return {
        ...deposit,
        profiles: profile,
      } as DepositWithProfile;
    },
    enabled: !!depositId,
  });
}

// Fetch deposit proofs
export function useDepositProofs(depositId: string | undefined) {
  return useQuery({
    queryKey: ['deposit-proofs', depositId],
    queryFn: async () => {
      if (!depositId) return [];

      const { data, error } = await supabase
        .from('deposit_proofs')
        .select('*')
        .eq('deposit_id', depositId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as DepositProof[];
    },
    enabled: !!depositId,
  });
}

// Fetch deposit timeline
export function useDepositTimeline(depositId: string | undefined) {
  return useQuery({
    queryKey: ['deposit-timeline', depositId],
    queryFn: async () => {
      if (!depositId) return [];

      const { data, error } = await supabase
        .from('deposit_timeline_events')
        .select('*')
        .eq('deposit_id', depositId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as DepositTimelineEvent[];
    },
    enabled: !!depositId,
  });
}

// Validate deposit mutation
export function useValidateDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId, adminComment }: { depositId: string; adminComment?: string }) => {
      const { data, error } = await supabase.rpc('validate_deposit', {
        p_deposit_id: depositId,
        p_admin_comment: adminComment || null,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; new_balance?: number; amount_credited?: number };
      
      if (!result.success) {
        throw new Error(result.error || 'Validation failed');
      }

      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      toast.success(`Dépôt validé ! Wallet crédité de ${data.amount_credited?.toLocaleString('fr-FR')} XAF`);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Reject deposit mutation
export function useRejectDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId, reason }: { depositId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('reject_deposit', {
        p_deposit_id: depositId,
        p_reason: reason,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      
      if (!result.success) {
        throw new Error(result.error || 'Rejection failed');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      toast.error('Dépôt rejeté');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Fetch wallet for user
export function useWalletByUserId(userId: string | undefined) {
  return useQuery({
    queryKey: ['wallet', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

// Status labels
export const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  created: 'Créé',
  awaiting_proof: 'En attente de preuve',
  proof_submitted: 'Preuve envoyée',
  admin_review: 'En vérification',
  validated: 'Validé',
  rejected: 'Rejeté',
};

// Method labels
export const DEPOSIT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Virement bancaire',
  bank_cash: 'Dépôt cash banque',
  agency_cash: 'Dépôt agence',
  om_transfer: 'Orange Money - Transfert',
  om_withdrawal: 'Orange Money - Retrait',
  mtn_transfer: 'MTN Money - Transfert',
  mtn_withdrawal: 'MTN Money - Retrait',
  wave: 'Wave',
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Cache configuration for performance
const STALE_TIME = 30 * 1000; // 30 seconds
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

export type DepositMethod = 'bank_transfer' | 'bank_cash' | 'agency_cash' | 'om_transfer' | 'om_withdrawal' | 'mtn_transfer' | 'mtn_withdrawal' | 'wave';
export type DepositStatus = 'created' | 'awaiting_proof' | 'proof_submitted' | 'admin_review' | 'validated' | 'rejected' | 'pending_correction';

export interface Deposit {
  id: string;
  user_id: string;
  reference: string;
  amount_xaf: number;
  method: DepositMethod;
  bank_name: string | null;
  agency_name: string | null;
  client_phone: string | null;
  status: DepositStatus;
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

// Helper to get current user
async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// Fetch all deposits for admin
export function useAdminDeposits() {
  return useQuery({
    queryKey: ['admin-deposits'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      // First get deposits
      const { data: deposits, error: depositsError } = await supabase
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

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
    staleTime: 10 * 1000, // 10 seconds for detail views
    gcTime: CACHE_TIME,
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

// Delete deposit mutation
export function useDeleteDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId }: { depositId: string }) => {
      // Delete proofs first (cascade might not work with storage)
      const { data: proofs } = await supabase
        .from('deposit_proofs')
        .select('file_url')
        .eq('deposit_id', depositId);

      // Delete files from storage if any
      if (proofs && proofs.length > 0) {
        for (const proof of proofs) {
          const path = proof.file_url.split('/deposit-proofs/')[1];
          if (path) {
            await supabase.storage.from('deposit-proofs').remove([path]);
          }
        }
      }

      // Delete deposit proofs records
      await supabase.from('deposit_proofs').delete().eq('deposit_id', depositId);

      // Delete timeline events
      await supabase.from('deposit_timeline_events').delete().eq('deposit_id', depositId);

      // Delete deposit
      const { error } = await supabase.from('deposits').delete().eq('id', depositId);

      if (error) throw error;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      toast.success('Dépôt supprimé avec succès');
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

// Create deposit mutation
export interface CreateDepositData {
  amount_xaf: number;
  method: DepositMethod;
  bank_name?: string;
  agency_name?: string;
  client_phone?: string;
}

export function useCreateDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDepositData) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Vous devez être connecté');

      // Use atomic RPC function that generates reference and inserts in one transaction
      const { data: result, error } = await supabase.rpc('create_client_deposit', {
        p_user_id: user.id,
        p_amount_xaf: data.amount_xaf,
        p_method: data.method,
        p_bank_name: data.bank_name || null,
        p_agency_name: data.agency_name || null,
        p_client_phone: data.client_phone || null,
      });

      if (error) throw error;

      const response = result as { success: boolean; error?: string; deposit_id?: string; reference?: string };
      
      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de la création du dépôt');
      }

      return { id: response.deposit_id, reference: response.reference };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Fetch current user's deposits
export function useMyDeposits() {
  return useQuery({
    queryKey: ['my-deposits'],
    staleTime: 10 * 1000, // 10 seconds for user's own data
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Deposit[];
    },
  });
}

// Upload proof
export function useUploadProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId, file }: { depositId: string; file: File }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Vous devez être connecté');

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${depositId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('deposit-proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the file path for later signed URL generation
      const storedPath = `deposit-proofs/${filePath}`;

      // Create proof record
      const { error: proofError } = await supabase.from('deposit_proofs').insert({
        deposit_id: depositId,
        file_url: storedPath,
        file_name: file.name,
        file_type: file.type,
      });

      if (proofError) throw proofError;

      // Update deposit status
      await supabase.from('deposits')
        .update({ status: 'proof_submitted' as DepositStatus })
        .eq('id', depositId);

      // Add timeline event
      await supabase.from('deposit_timeline_events').insert({
        deposit_id: depositId,
        event_type: 'proof_submitted',
        description: 'Preuve de dépôt envoyée',
        performed_by: user.id,
      });

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-proofs', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      toast.success('Preuve envoyée avec succès');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Delete deposit proof mutation
export function useDeleteDepositProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ proofId, fileUrl }: { proofId: string; fileUrl: string }) => {
      // Extract the file path from the URL
      const path = fileUrl.split('/deposit-proofs/')[1];
      
      // Delete file from storage
      if (path) {
        const { error: storageError } = await supabase.storage
          .from('deposit-proofs')
          .remove([path]);
        
        if (storageError) {
          console.error('Storage delete error:', storageError);
          // Continue even if storage delete fails
        }
      }

      // Delete proof record from database
      const { error } = await supabase
        .from('deposit_proofs')
        .delete()
        .eq('id', proofId);

      if (error) throw error;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposit-proofs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      toast.success('Preuve supprimée avec succès');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
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
  pending_correction: 'À corriger',
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

// Request correction mutation (admin requests client to fix something)
export function useRequestCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId, reason }: { depositId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('request_deposit_correction', {
        p_deposit_id: depositId,
        p_reason: reason,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Request correction failed');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      toast.success('Demande de correction envoyée au client');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Resubmit deposit mutation (client resubmits after correction)
export function useResubmitDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId }: { depositId: string }) => {
      const { data, error } = await supabase.rpc('resubmit_deposit', {
        p_deposit_id: depositId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Resubmit failed');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      toast.success('Dépôt renvoyé avec succès');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

// Fetch deposit stats for admin dashboard
export interface DepositStats {
  total: number;
  awaiting_proof: number;
  proof_submitted: number;
  pending_correction: number;
  admin_review: number;
  validated: number;
  rejected: number;
  to_process: number;
  today_validated: number;
  today_amount: number;
}

export function useDepositStats() {
  return useQuery({
    queryKey: ['deposit-stats'],
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 60 * 1000, // 1 minute
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_deposit_stats');

      if (error) throw error;

      return data as DepositStats;
    },
  });
}

// Start deposit review mutation (admin marks as in review)
export function useStartDepositReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId }: { depositId: string }) => {
      const { data, error } = await supabase.rpc('start_deposit_review', {
        p_deposit_id: depositId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Failed to start review');
      }

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

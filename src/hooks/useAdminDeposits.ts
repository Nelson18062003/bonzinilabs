// ============================================================
// ADMIN-SIDE DEPOSIT HOOKS (from scratch)
// CRITICAL: Uses `supabaseAdmin` (admin session, storageKey: bonzini-admin-auth)
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { validateUploadFile } from '@/lib/utils';
import type {
  DepositWithProfile,
  DepositProofWithUrl,
  DepositTimelineEvent,
  AdminCreateDepositData,
} from '@/types/deposit';
import { compressImage } from '@/lib/imageCompression';

async function getAdminUser() {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser();
  if (error || !user) return null;
  return user;
}

// Helper to get signed URL for deposit proofs
async function getProofSignedUrl(fileUrl: string): Promise<string | null> {
  const path = fileUrl.replace('deposit-proofs/', '');
  const { data, error } = await supabaseAdmin.storage
    .from('deposit-proofs')
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

// ── Queries ──────────────────────────────────────────────────

export function useAdminDeposits() {
  return useQuery({
    queryKey: ['admin-deposits'],
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const { data: deposits, error: depositsError } = await supabaseAdmin
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (depositsError) throw depositsError;
      if (!deposits || deposits.length === 0) return [];

      const userIds = [...new Set(deposits.map((d) => d.user_id))];

      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name, phone, company_name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map((c) => [c.user_id, c]) || []);

      return deposits.map((deposit) => ({
        ...deposit,
        profiles: profileMap.get(deposit.user_id) || null,
      })) as DepositWithProfile[];
    },
  });
}

export function useAdminDepositDetail(depositId: string | undefined) {
  return useQuery({
    queryKey: ['admin-deposit', depositId],
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!depositId) return null;

      const { data: deposit, error: depositError } = await supabaseAdmin
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .maybeSingle();

      if (depositError) throw depositError;
      if (!deposit) return null;

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name, phone, company_name')
        .eq('user_id', deposit.user_id)
        .maybeSingle();

      return {
        ...deposit,
        profiles: profile || null,
      } as DepositWithProfile;
    },
    enabled: !!depositId,
  });
}

export function useAdminDepositProofs(depositId: string | undefined) {
  return useQuery({
    queryKey: ['admin-deposit-proofs', depositId],
    queryFn: async () => {
      if (!depositId) return [];
      const { data, error } = await supabaseAdmin
        .from('deposit_proofs')
        .select('*')
        .eq('deposit_id', depositId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [] as DepositProofWithUrl[];

      const proofsWithUrls = await Promise.all(
        data.map(async (proof) => {
          const signedUrl = await getProofSignedUrl(proof.file_url);
          return { ...proof, signedUrl } as DepositProofWithUrl;
        }),
      );

      return proofsWithUrls;
    },
    enabled: !!depositId,
  });
}

export function useAdminDepositTimeline(depositId: string | undefined) {
  return useQuery({
    queryKey: ['admin-deposit-timeline', depositId],
    queryFn: async () => {
      if (!depositId) return [];
      const { data, error } = await supabaseAdmin
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

export function useDepositStats() {
  return useQuery({
    queryKey: ['deposit-stats'],
    staleTime: 10_000,
    gcTime: 60_000,
    queryFn: async () => {
      // Fetch stats manually since get_deposit_stats RPC may not exist
      const [totalRes, awaitingRes, proofRes, reviewRes, validatedRes, rejectedRes] = await Promise.all([
        supabaseAdmin.from('deposits').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('deposits').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_proof'),
        supabaseAdmin.from('deposits').select('id', { count: 'exact', head: true }).eq('status', 'proof_submitted'),
        supabaseAdmin.from('deposits').select('id', { count: 'exact', head: true }).eq('status', 'admin_review'),
        supabaseAdmin.from('deposits').select('id', { count: 'exact', head: true }).eq('status', 'validated'),
        supabaseAdmin.from('deposits').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);

      const to_process = (awaitingRes.count || 0) + (proofRes.count || 0) + (reviewRes.count || 0);
      const today_amount_xaf_val = 0; // Would need a separate query for today's amount

      return {
        total: totalRes.count || 0,
        awaiting_proof: awaitingRes.count || 0,
        proof_submitted: proofRes.count || 0,
        admin_review: reviewRes.count || 0,
        validated: validatedRes.count || 0,
        rejected: rejectedRes.count || 0,
        pending_correction: 0,
        created: 0,
        cancelled: 0,
        today_validated: 0,
        today_amount_xaf: today_amount_xaf_val,
        to_process: to_process,
        today_amount: today_amount_xaf_val,
      };
    },
  });
}

export function useAdminWalletByUserId(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin-wallet', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabaseAdmin
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

export function useAllClients() {
  return useQuery({
    queryKey: ['all-clients-for-deposit'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name, phone, company_name')
        .order('first_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

// ── Admin action mutations ───────────────────────────────────

export function useValidateDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      depositId,
      adminComment,
    }: {
      depositId: string;
      adminComment?: string;
      confirmedAmount?: number;
      sendNotification?: boolean;
    }) => {
      const { data, error } = await supabaseAdmin.rpc('validate_deposit', {
        p_deposit_id: depositId,
        p_admin_comment: adminComment || undefined,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; error?: string; new_balance?: number; amount_credited?: number };
      if (!result.success) throw new Error(result.error || 'Validation échouée');

      return result;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposits-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposit-timeline', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(`Dépôt validé ! Wallet crédité de ${formatCurrency(data.amount_credited || 0)}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRejectDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      depositId,
      reason,
    }: {
      depositId: string;
      reason: string;
      rejectionCategory?: string;
      adminNote?: string;
    }) => {
      const { data, error } = await supabaseAdmin.rpc('reject_deposit', {
        p_deposit_id: depositId,
        p_reason: reason,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || 'Rejet échoué');

      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposits-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposit-timeline', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      toast.error('Dépôt rejeté');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ── Admin create deposit for client ─────────────

export function useAdminCreateDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AdminCreateDepositData) => {
      const admin = await getAdminUser();
      if (!admin) throw new Error('Vous devez être connecté');

      const { data: result, error } = await supabaseAdmin.rpc('create_client_deposit', {
        p_user_id: data.user_id,
        p_amount_xaf: data.amount_xaf,
        p_method: data.method,
        p_bank_name: data.bank_name || undefined,
        p_agency_name: data.agency_name || undefined,
        p_client_phone: data.client_phone || undefined,
      });

      if (error) throw error;

      const response = result as unknown as { success: boolean; error?: string; deposit_id?: string; reference?: string };
      if (!response.success) throw new Error(response.error || 'Erreur lors de la création');

      const depositId = response.deposit_id!;

      if (data.admin_comment) {
        await supabaseAdmin.from('deposits')
          .update({ admin_comment: data.admin_comment })
          .eq('id', depositId);
      }

      if (data.proofFiles && data.proofFiles.length > 0) {
        let proofUploadCount = 0;
        for (const rawFile of data.proofFiles) {
          try {
            validateUploadFile(rawFile);
            const file = await compressImage(rawFile);
            const fileExt = file.name.split('.').pop();
            const filePath = `${data.user_id}/${depositId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabaseAdmin.storage
              .from('deposit-proofs')
              .upload(filePath, file);

            if (uploadError) {
              console.error(`[Create] Proof upload failed for ${file.name}:`, uploadError.message);
              continue;
            }

            const storedPath = `deposit-proofs/${filePath}`;
            await supabaseAdmin.from('deposit_proofs').insert({
              deposit_id: depositId,
              file_url: storedPath,
              file_name: file.name,
              file_type: file.type,
            });
            proofUploadCount++;
          } catch (err) {
            console.error(`[Create] Proof error for ${rawFile.name}:`, err);
          }
        }

        if (proofUploadCount > 0) {
          await supabaseAdmin.from('deposits')
            .update({ status: 'proof_submitted' })
            .eq('id', depositId);

          await supabaseAdmin.from('deposit_timeline_events').insert({
            deposit_id: depositId,
            event_type: 'proof_submitted',
            description: `${proofUploadCount} preuve(s) ajoutée(s) par l'admin`,
            performed_by: admin.id,
          });
        }
      }

      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_user_id: admin.id,
        action_type: 'create_deposit_for_client',
        target_type: 'deposit',
        target_id: depositId,
        details: {
          client_user_id: data.user_id,
          amount_xaf: data.amount_xaf,
          method: data.method,
          proofs_count: data.proofFiles?.length || 0,
        },
      });

      return { id: depositId, reference: response.reference };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Dépôt créé avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAdminUploadProofs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId, userId, files, depositStatus }: {
      depositId: string;
      userId: string;
      files: File[];
      depositStatus?: string;
    }) => {
      const admin = await getAdminUser();
      if (!admin) throw new Error('Vous devez être connecté');

      let uploadedCount = 0;
      const failedFiles: string[] = [];

      for (const rawFile of files) {
        try {
          const file = await compressImage(rawFile);
          const fileExt = file.name.split('.').pop();
          const filePath = `${userId}/${depositId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from('deposit-proofs')
            .upload(filePath, file);

          if (uploadError) {
            console.error(`[Upload] Failed for ${file.name}:`, uploadError.message);
            failedFiles.push(file.name);
            continue;
          }

          const storedPath = `deposit-proofs/${filePath}`;
          const { error: insertError } = await supabaseAdmin.from('deposit_proofs').insert({
            deposit_id: depositId,
            file_url: storedPath,
            file_name: file.name,
            file_type: file.type,
          });

          if (insertError) {
            console.error(`[Upload] DB insert failed for ${file.name}:`, insertError.message);
            failedFiles.push(file.name);
            continue;
          }

          uploadedCount++;
        } catch (err) {
          console.error(`[Upload] Unexpected error for ${rawFile.name}:`, err);
          failedFiles.push(rawFile.name);
        }
      }

      if (uploadedCount === 0 && failedFiles.length > 0) {
        throw new Error(`Échec de l'upload: ${failedFiles.join(', ')}`);
      }

      const UPLOADABLE_STATES = ['created', 'awaiting_proof', 'pending_correction'];
      if (uploadedCount > 0 && UPLOADABLE_STATES.includes(depositStatus || '')) {
        await supabaseAdmin.from('deposits')
          .update({ status: 'proof_submitted', updated_at: new Date().toISOString() })
          .eq('id', depositId);

        await supabaseAdmin.from('deposit_timeline_events').insert({
          deposit_id: depositId,
          event_type: 'proof_submitted',
          description: `${uploadedCount} preuve(s) ajoutée(s) par l'admin`,
          performed_by: admin.id,
        });
      }

      return { uploadedCount, failedFiles };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposit-proofs', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposit-timeline', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });

      if (data.failedFiles.length > 0 && data.uploadedCount > 0) {
        toast.warning(`${data.uploadedCount} preuve(s) envoyée(s), ${data.failedFiles.length} échec(s)`);
      } else {
        toast.success(`${data.uploadedCount} preuve(s) envoyée(s) avec succès`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useAdminDeleteDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (depositId: string) => {
      const { data, error } = await supabaseAdmin.rpc('delete_deposit', {
        p_deposit_id: depositId,
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || 'Erreur');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposits-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Dépôt supprimé');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Stub exports for features referenced but not yet implemented
export function useRequestCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_params: { depositId: string; reason: string }) => {},
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-deposits'] }); },
  });
}

export function useStartDepositReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_depositId: string) => {},
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-deposits'] }); },
  });
}

export function useAdminDeleteProof() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_proofId: string) => {},
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-deposit-proofs'] }); },
  });
}

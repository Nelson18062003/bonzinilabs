// ============================================================
// ADMIN-SIDE DEPOSIT HOOKS (from scratch)
// CRITICAL: Uses `supabaseAdmin` (admin session, storageKey: bonzini-admin-auth)
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { validateUploadFile } from '@/lib/utils';
import i18n from '@/i18n';
import type {
  DepositWithProfile,
  DepositProof,
  DepositProofWithUrl,
  DepositTimelineEvent,
  DepositStats,
  AdminCreateDepositData,
} from '@/types/deposit';
import { compressImage } from '@/lib/imageCompression';

async function getAdminUser() {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser();
  if (error || !user) return null;
  return user;
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

      const { data: clients, error: clientsError } = await supabaseAdmin
        .from('clients')
        .select('user_id, first_name, last_name, phone, company_name')
        .in('user_id', userIds);

      if (clientsError) throw clientsError;

      const clientMap = new Map(clients?.map((c) => [c.user_id, c]) || []);

      return deposits.map((deposit) => ({
        ...deposit,
        profiles: clientMap.get(deposit.user_id) || null,
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

      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('user_id, first_name, last_name, phone, company_name')
        .eq('user_id', deposit.user_id)
        .maybeSingle();

      return {
        ...deposit,
        profiles: client || null,
      } as DepositWithProfile;
    },
    enabled: !!depositId,
  });
}

export function useAdminDepositProofs(depositId: string | undefined) {
  return useQuery({
    queryKey: ['admin-deposit-proofs', depositId],
    staleTime: 55 * 60_000, // Signed URLs valid 1h — avoid re-generating every navigation
    gcTime: 60 * 60_000,
    queryFn: async () => {
      if (!depositId) return [];
      const { data, error } = await supabaseAdmin
        .from('deposit_proofs')
        .select('*')
        .eq('deposit_id', depositId)
        .is('deleted_at', null)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [] as DepositProofWithUrl[];

      // Fetch signed URLs for all proofs in parallel
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
    staleTime: 60_000, // 1 minute — updated via invalidation after mutations
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.rpc('get_deposit_stats');
      if (error) throw error;
      return data as DepositStats;
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
        .select('id, user_id, balance_xaf, created_at, updated_at')
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
        .from('clients')
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
      sendNotification,
    }: {
      depositId: string;
      adminComment?: string;
      sendNotification?: boolean;
    }) => {
      const { data, error } = await supabaseAdmin.rpc('validate_deposit', {
        p_deposit_id: depositId,
        p_admin_comment: adminComment || null,
        p_send_notification: sendNotification ?? true,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; new_balance?: number; amount_credited?: number };
      if (!result.success) throw new Error(result.error || i18n.t('hooks.validateDeposit.error', { ns: 'common', defaultValue: 'Validation échouée' }));

      return result;
    },
    onSuccess: (data, variables) => {
      const { depositId } = variables;
      const newStatus = 'validated';

      // Update status in-cache for all deposit lists (no refetch)
      queryClient.setQueryData(
        ['admin-deposit', depositId],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => old ? { ...old, status: newStatus } : old,
      );
      queryClient.setQueryData(
        ['admin-deposits'],
        (old: DepositWithProfile[] | undefined) =>
          old?.map(d => d.id === depositId ? { ...d, status: newStatus } : d) ?? old,
      );
      queryClient.setQueriesData(
        { queryKey: ['admin-deposits-paginated'] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => old?.pages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? { ...old, pages: old.pages.map((p: any) => ({ ...p, data: p.data?.map((d: any) => d.id === depositId ? { ...d, status: newStatus } : d) })) }
          : old,
      );

      // Only refetch what can't be computed locally
      queryClient.invalidateQueries({ queryKey: ['admin-deposit-timeline', depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(i18n.t('hooks.validateDeposit.success', { ns: 'common', defaultValue: `Dépôt validé ! Wallet crédité de ${formatCurrency(data.amount_credited || 0)}`, amount: formatCurrency(data.amount_credited || 0) }));
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
      rejectionCategory,
      adminNote,
    }: {
      depositId: string;
      reason: string;
      rejectionCategory?: string;
      adminNote?: string;
    }) => {
      const { data, error } = await supabaseAdmin.rpc('reject_deposit', {
        p_deposit_id: depositId,
        p_reason: reason,
        p_rejection_category: rejectionCategory || null,
        p_admin_note: adminNote || null,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || i18n.t('hooks.rejectDeposit.error', { ns: 'common', defaultValue: 'Rejet échoué' }));

      return result;
    },
    onSuccess: (_, variables) => {
      const { depositId } = variables;
      const newStatus = 'rejected';

      queryClient.setQueryData(
        ['admin-deposit', depositId],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => old ? { ...old, status: newStatus } : old,
      );
      queryClient.setQueryData(
        ['admin-deposits'],
        (old: DepositWithProfile[] | undefined) =>
          old?.map(d => d.id === depositId ? { ...d, status: newStatus } : d) ?? old,
      );
      queryClient.setQueriesData(
        { queryKey: ['admin-deposits-paginated'] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => old?.pages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? { ...old, pages: old.pages.map((p: any) => ({ ...p, data: p.data?.map((d: any) => d.id === depositId ? { ...d, status: newStatus } : d) })) }
          : old,
      );

      queryClient.invalidateQueries({ queryKey: ['admin-deposit-timeline', depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      toast.error(i18n.t('hooks.rejectDeposit.success', { ns: 'common', defaultValue: 'Dépôt rejeté' }));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useStartDepositReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId }: { depositId: string }) => {
      const { data, error } = await supabaseAdmin.rpc('start_deposit_review', {
        p_deposit_id: depositId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || i18n.t('hooks.startReview.error', { ns: 'common', defaultValue: 'Erreur' }));

      return result;
    },
    onSuccess: (_, variables) => {
      const { depositId } = variables;
      const newStatus = 'admin_review';

      queryClient.setQueryData(
        ['admin-deposit', depositId],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => old ? { ...old, status: newStatus } : old,
      );
      queryClient.setQueryData(
        ['admin-deposits'],
        (old: DepositWithProfile[] | undefined) =>
          old?.map(d => d.id === depositId ? { ...d, status: newStatus } : d) ?? old,
      );
      queryClient.setQueriesData(
        { queryKey: ['admin-deposits-paginated'] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => old?.pages
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? { ...old, pages: old.pages.map((p: any) => ({ ...p, data: p.data?.map((d: any) => d.id === depositId ? { ...d, status: newStatus } : d) })) }
          : old,
      );

      queryClient.invalidateQueries({ queryKey: ['admin-deposit-timeline', depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ── Admin create deposit for client (Brique A2) ─────────────

export function useAdminCreateDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AdminCreateDepositData) => {
      const admin = await getAdminUser();
      if (!admin) throw new Error(i18n.t('hooks.auth.mustBeLoggedIn', { ns: 'common', defaultValue: 'Vous devez être connecté' }));

      const { data: result, error } = await supabaseAdmin.rpc('create_client_deposit', {
        p_user_id: data.user_id,
        p_amount_xaf: data.amount_xaf,
        p_method: data.method,
        p_bank_name: data.bank_name || null,
        p_agency_name: data.agency_name || null,
        p_client_phone: data.client_phone || null,
      });

      if (error) throw error;

      const response = result as { success: boolean; error?: string; deposit_id?: string; reference?: string };
      if (!response.success) throw new Error(response.error || i18n.t('hooks.adminCreateDeposit.error', { ns: 'common', defaultValue: 'Erreur lors de la création' }));

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
            const { error: insertError } = await supabaseAdmin.from('deposit_proofs').insert({
              deposit_id: depositId,
              file_url: storedPath,
              file_name: file.name,
              file_type: file.type,
              uploaded_by: admin.id,
              uploaded_by_type: 'admin' as const,
            });

            if (insertError) {
              console.error(`[Create] DB insert failed for ${file.name}:`, insertError.message);
              // Remove the orphaned storage file
              await supabaseAdmin.storage.from('deposit-proofs').remove([filePath]);
              continue;
            }

            proofUploadCount++;
          } catch (err) {
            console.error(`[Create] Proof error for ${rawFile.name}:`, err);
          }
        }

        if (proofUploadCount > 0) {
          await supabaseAdmin.rpc('submit_deposit_proof', { p_deposit_id: depositId });
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
      toast.success(i18n.t('hooks.adminCreateDeposit.success', { ns: 'common', defaultValue: 'Dépôt créé avec succès' }));
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
      if (!admin) throw new Error(i18n.t('hooks.auth.mustBeLoggedIn', { ns: 'common', defaultValue: 'Vous devez être connecté' }));

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
            uploaded_by: admin.id,
            uploaded_by_type: 'admin' as const,
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
        throw new Error(i18n.t('hooks.uploadMultiple.allFailed', { ns: 'common', defaultValue: `Échec de l'upload: ${failedFiles.join(', ')}`, files: failedFiles.join(', ') }));
      }

      // Advance to proof_submitted via server-side RPC
      if (uploadedCount > 0) {
        await supabaseAdmin.rpc('submit_deposit_proof', { p_deposit_id: depositId });
      }

      return { success: true, uploadedCount, failedFiles };
    },
    onSuccess: (data, variables) => {
      // Proofs, detail and timeline definitely changed
      queryClient.invalidateQueries({ queryKey: ['admin-deposit-proofs', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposit-timeline', variables.depositId] });
      // Paginated list status may have changed
      queryClient.invalidateQueries({ queryKey: ['admin-deposits-paginated'] });
      // Note: upload doesn't affect financial stats — deposit-stats not invalidated

      if (data.failedFiles && data.failedFiles.length > 0) {
        toast.warning(`${data.uploadedCount} preuve(s) ajoutée(s), ${data.failedFiles.length} échec(s)`);
      } else {
        toast.success(`${data.uploadedCount} preuve(s) ajoutée(s)`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/** @deprecated Use useCancelDeposit instead — delete erases ledger history */
export function useDeleteDeposit() {
  return useCancelDeposit();
}

export function useCancelDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId }: { depositId: string }) => {
      const { data, error } = await supabaseAdmin.rpc('cancel_deposit', {
        p_deposit_id: depositId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || "Erreur lors de l'annulation");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit-stats'] });
      queryClient.invalidateQueries({ queryKey: ['client-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['all-wallets'] });
      toast.success('Dépôt annulé');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ── Admin soft-delete proof ───────────────────────────────────

export function useAdminDeleteProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      proofId,
      depositId,
      reason,
    }: {
      proofId: string;
      depositId: string;
      reason: string;
    }) => {
      const admin = await getAdminUser();
      if (!admin) throw new Error('Vous devez être connecté');

      // Soft-delete the proof
      const { error } = await supabaseAdmin
        .from('deposit_proofs')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: admin.id,
          delete_reason: reason,
        })
        .eq('id', proofId);

      if (error) throw error;

      // Check if any active proofs remain
      const { count } = await supabaseAdmin
        .from('deposit_proofs')
        .select('id', { count: 'exact', head: true })
        .eq('deposit_id', depositId)
        .is('deleted_at', null);

      // If no proofs remain, revert to created via server-side RPC
      if (count === 0) {
        await supabaseAdmin.rpc('revert_deposit_to_created', { p_deposit_id: depositId });
      }

      // Timeline event
      await supabaseAdmin.from('deposit_timeline_events').insert({
        deposit_id: depositId,
        event_type: 'proof_deleted',
        description: `Preuve supprimée par l'admin - Motif: ${reason}`,
        performed_by: admin.id,
      });

      // Audit log
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_user_id: admin.id,
        action_type: 'delete_deposit_proof',
        target_type: 'deposit_proof',
        target_id: proofId,
        details: {
          deposit_id: depositId,
          reason,
        },
      });

      return { success: true };
    },
    onSuccess: (_, variables) => {
      // Proofs, detail (status may revert) and timeline definitely changed
      queryClient.invalidateQueries({ queryKey: ['admin-deposit-proofs', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['admin-deposit-timeline', variables.depositId] });
      // Paginated list status may have changed (revert to 'created' if no proofs left)
      queryClient.invalidateQueries({ queryKey: ['admin-deposits-paginated'] });
      // Note: proof deletion doesn't affect financial stats — deposit-stats not invalidated
      toast.success('Preuve supprimée');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ── Helper: Generate signed URL for proof viewing ────────────

export async function getProofSignedUrl(fileUrl: string): Promise<string | null> {
  const path = fileUrl.replace('deposit-proofs/', '');
  const { data, error } = await supabaseAdmin.storage
    .from('deposit-proofs')
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

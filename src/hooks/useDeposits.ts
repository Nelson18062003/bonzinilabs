// ============================================================
// CLIENT-SIDE DEPOSIT HOOKS (from scratch)
// Uses `supabase` (client session, storageKey: bonzini-client-auth)
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import { validateUploadFile } from '@/lib/utils';
import type {
  Deposit,
  DepositProofWithUrl,
  DepositTimelineEvent,
  DepositStatus,
  CreateDepositData,
} from '@/types/deposit';

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ── Queries ──────────────────────────────────────────────────

export function useMyDeposits() {
  return useQuery({
    queryKey: ['my-deposits'],
    staleTime: 10_000,
    gcTime: 5 * 60_000,
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

export function useDepositDetail(depositId: string | undefined) {
  return useQuery({
    queryKey: ['deposit', depositId],
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      if (!depositId) return null;

      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .eq('id', depositId)
        .maybeSingle();

      if (error) throw error;
      return data as Deposit | null;
    },
    enabled: !!depositId,
  });
}

export function useDepositProofs(depositId: string | undefined) {
  return useQuery({
    queryKey: ['deposit-proofs', depositId],
    staleTime: 55 * 60_000, // Signed URLs valid 1h — avoid re-generating every navigation
    gcTime: 60 * 60_000,
    queryFn: async () => {
      if (!depositId) return [] as DepositProofWithUrl[];
      const { data, error } = await supabase
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
          const signedUrl = await getClientProofSignedUrl(proof.file_url);
          return { ...proof, signedUrl } as DepositProofWithUrl;
        }),
      );

      return proofsWithUrls;
    },
    enabled: !!depositId,
  });
}

async function getClientProofSignedUrl(fileUrl: string): Promise<string | null> {
  const path = fileUrl.replace('deposit-proofs/', '');
  const { data, error } = await supabase.storage
    .from('deposit-proofs')
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

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

// ── Mutations ────────────────────────────────────────────────

export function useCreateDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDepositData) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Vous devez être connecté');

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
      if (!response.success) throw new Error(response.error || 'Erreur lors de la création du dépôt');

      return { id: response.deposit_id, reference: response.reference };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUploadProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId, file: rawFile }: { depositId: string; file: File }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Vous devez être connecté');

      validateUploadFile(rawFile);
      const file = await compressImage(rawFile);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${depositId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('deposit-proofs')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const storedPath = `deposit-proofs/${filePath}`;

      const { error: proofError } = await supabase.from('deposit_proofs').insert({
        deposit_id: depositId,
        file_url: storedPath,
        file_name: rawFile.name,
        file_type: file.type,
        uploaded_by: user.id,
        uploaded_by_type: 'client' as const,
      });
      if (proofError) throw proofError;

      // Advance status to proof_submitted via server-side RPC
      await supabase.rpc('submit_deposit_proof', { p_deposit_id: depositId });

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-proofs', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      toast.success('Preuve envoyée avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUploadMultipleProofs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId, files }: { depositId: string; files: File[] }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Vous devez être connecté');

      let uploadedCount = 0;
      const failedFiles: string[] = [];

      for (const rawFile of files) {
        try {
          const file = await compressImage(rawFile);
          const fileExt = file.name.split('.').pop();
          const filePath = `${user.id}/${depositId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('deposit-proofs')
            .upload(filePath, file);

          if (uploadError) {
            console.error(`[Upload] Failed for ${rawFile.name}:`, uploadError.message);
            failedFiles.push(rawFile.name);
            continue;
          }

          const storedPath = `deposit-proofs/${filePath}`;

          const { error: proofError } = await supabase.from('deposit_proofs').insert({
            deposit_id: depositId,
            file_url: storedPath,
            file_name: rawFile.name,
            file_type: file.type,
            uploaded_by: user.id,
            uploaded_by_type: 'client' as const,
          });

          if (proofError) {
            console.error(`[Upload] DB insert failed for ${rawFile.name}:`, proofError.message);
            failedFiles.push(rawFile.name);
            continue;
          }

          uploadedCount++;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          console.error(`[Upload] Unexpected error for ${rawFile.name}:`, err);
          failedFiles.push(rawFile.name);
        }
      }

      if (uploadedCount === 0 && failedFiles.length > 0) {
        throw new Error(`Échec de l'upload: ${failedFiles.join(', ')}`);
      }

      if (uploadedCount > 0) {
        // Advance status to proof_submitted via server-side RPC
        await supabase.rpc('submit_deposit_proof', { p_deposit_id: depositId });
      }

      return { uploadedCount, failedFiles };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-proofs', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });

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

export function useDeleteDepositProof() {
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
      const user = await getCurrentUser();
      if (!user) throw new Error('Vous devez être connecté');

      // Soft-delete: set deleted_at, deleted_by, delete_reason
      const { error } = await supabase
        .from('deposit_proofs')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          delete_reason: reason,
        })
        .eq('id', proofId);

      if (error) throw error;

      // Check if any active proofs remain — revert status if none left
      const { count } = await supabase
        .from('deposit_proofs')
        .select('id', { count: 'exact', head: true })
        .eq('deposit_id', depositId)
        .is('deleted_at', null);

      if (count === 0) {
        // Revert to created via server-side RPC (validates status guards)
        await supabase.rpc('revert_deposit_to_created', { p_deposit_id: depositId });
      }

      // Timeline event for traceability
      await supabase.from('deposit_timeline_events').insert({
        deposit_id: depositId,
        event_type: 'proof_deleted',
        description: 'Preuve supprimée par le client',
        performed_by: user.id,
      });

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposit-proofs', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      toast.success('Preuve supprimée');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCancelDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId }: { depositId: string }) => {
      const { data, error } = await supabase.rpc('cancel_client_deposit', {
        p_deposit_id: depositId,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; reference?: string };
      if (!result.success) throw new Error(result.error || 'Erreur lors de l\'annulation');
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      toast.success('Dépôt annulé avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}


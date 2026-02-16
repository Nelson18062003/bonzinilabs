// Client-side deposit hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import type {
  Deposit,
  DepositTimelineEvent,
  CreateDepositData,
} from '@/types/deposit';

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

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
    queryFn: async () => {
      if (!depositId) return [];
      const { data, error } = await supabase
        .from('deposit_proofs')
        .select('*')
        .eq('deposit_id', depositId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const proofsWithUrls = await Promise.all(
        data.map(async (proof) => {
          const signedUrl = await getClientProofSignedUrl(proof.file_url);
          return { ...proof, signedUrl };
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
        p_bank_name: data.bank_name || undefined,
        p_agency_name: data.agency_name || undefined,
        p_client_phone: data.client_phone || undefined,
      });
      if (error) throw error;
      const response = result as unknown as { success: boolean; error?: string; deposit_id?: string; reference?: string };
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
      const file = await compressImage(rawFile);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${depositId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('deposit-proofs').upload(filePath, file);
      if (uploadError) throw uploadError;
      const storedPath = `deposit-proofs/${filePath}`;
      const { error: proofError } = await supabase.from('deposit_proofs').insert({
        deposit_id: depositId,
        file_url: storedPath,
        file_name: rawFile.name,
        file_type: file.type,
      });
      if (proofError) throw proofError;
      await supabase.from('deposits').update({ status: 'proof_submitted' }).eq('id', depositId);
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
          const { error: uploadError } = await supabase.storage.from('deposit-proofs').upload(filePath, file);
          if (uploadError) { failedFiles.push(rawFile.name); continue; }
          const storedPath = `deposit-proofs/${filePath}`;
          const { error: proofError } = await supabase.from('deposit_proofs').insert({
            deposit_id: depositId, file_url: storedPath, file_name: rawFile.name, file_type: file.type,
          });
          if (proofError) { failedFiles.push(rawFile.name); continue; }
          uploadedCount++;
        } catch { failedFiles.push(rawFile.name); }
      }
      if (uploadedCount === 0 && failedFiles.length > 0) throw new Error(`Échec de l'upload: ${failedFiles.join(', ')}`);
      if (uploadedCount > 0) {
        await supabase.from('deposits').update({ status: 'proof_submitted' }).eq('id', depositId);
        await supabase.from('deposit_timeline_events').insert({
          deposit_id: depositId, event_type: 'proof_submitted',
          description: `${uploadedCount} preuve(s) envoyée(s)`, performed_by: user.id,
        });
      }
      return { uploadedCount, failedFiles };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-proofs', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      if (data.failedFiles.length > 0) toast.warning(`${data.uploadedCount} envoyée(s), ${data.failedFiles.length} échec(s)`);
      else toast.success(`${data.uploadedCount} preuve(s) envoyée(s)`);
    },
    onError: (error: Error) => { toast.error(error.message); },
  });
}
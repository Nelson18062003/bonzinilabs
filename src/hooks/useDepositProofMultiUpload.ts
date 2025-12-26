import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export function useUploadMultipleProofs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId, files }: { depositId: string; files: File[] }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Vous devez être connecté');

      const uploadedProofs = [];

      for (const file of files) {
        // Upload file to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${depositId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('deposit-proofs')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('deposit-proofs')
          .getPublicUrl(fileName);

        // Create proof record
        const { error: proofError } = await supabase.from('deposit_proofs').insert({
          deposit_id: depositId,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
        });

        if (proofError) throw proofError;

        uploadedProofs.push({ file_name: file.name, file_url: publicUrl });
      }

      // Update deposit status
      await supabase.from('deposits')
        .update({ status: 'proof_submitted' })
        .eq('id', depositId);

      // Add timeline event
      await supabase.from('deposit_timeline_events').insert({
        deposit_id: depositId,
        event_type: 'proof_submitted',
        description: `${files.length} preuve${files.length > 1 ? 's' : ''} de dépôt envoyée${files.length > 1 ? 's' : ''}`,
        performed_by: user.id,
      });

      return { success: true, count: files.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-proofs', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      toast.success(`${data.count} preuve${data.count > 1 ? 's' : ''} envoyée${data.count > 1 ? 's' : ''} avec succès`);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createSignedUrl } from '@/lib/signedUrls';
import { compressImage } from '@/lib/imageCompression';

export function useAdminUploadProofs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ depositId, files }: { depositId: string; files: File[] }) => {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser();
      if (authError || !user) throw new Error('Non authentifié');

      const uploadedProofs = [];

      for (const rawFile of files) {
        const file = await compressImage(rawFile);
        const fileExt = file.name.split('.').pop();
        const filePath = `admin/${depositId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('deposit-proofs')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get signed URL for immediate display
        const signedUrl = await createSignedUrl('deposit-proofs', filePath);
        
        // Store the file path for later signed URL generation
        const storedPath = `deposit-proofs/${filePath}`;

        // Create proof record
        const { error: proofError } = await supabaseAdmin.from('deposit_proofs').insert({
          deposit_id: depositId,
          file_url: storedPath,
          file_name: file.name,
          file_type: file.type,
        });

        if (proofError) throw proofError;

        uploadedProofs.push({ file_name: file.name, file_url: signedUrl });
      }

      // Add timeline event
      await supabaseAdmin.from('deposit_timeline_events').insert({
        deposit_id: depositId,
        event_type: 'proof_added',
        description: `${files.length} preuve${files.length > 1 ? 's' : ''} ajoutée${files.length > 1 ? 's' : ''} par l'admin`,
        performed_by: user.id,
      });

      // Add audit log
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_user_id: user.id,
        action_type: 'add_deposit_proofs',
        target_type: 'deposit',
        target_id: depositId,
        details: { files_count: files.length, file_names: uploadedProofs.map(p => p.file_name) },
      });

      return { success: true, count: files.length };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deposit', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-proofs', variables.depositId] });
      queryClient.invalidateQueries({ queryKey: ['deposit-timeline', variables.depositId] });
      toast.success(`${data.count} preuve${data.count > 1 ? 's' : ''} ajoutée${data.count > 1 ? 's' : ''}`);
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

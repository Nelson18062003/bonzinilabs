import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function usePaymentProofMultiUpload() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [uploadProgress, setUploadProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async ({
      paymentId,
      files,
      description,
    }: {
      paymentId: string;
      files: File[];
      description?: string;
    }) => {
      if (!user?.id) throw new Error('Non authentifié');

      const results: { success: boolean; fileName: string; error?: string }[] = [];
      let completed = 0;

      for (const file of files) {
        try {
          const fileName = `instructions/${paymentId}/${Date.now()}_${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('payment-proofs')
            .getPublicUrl(fileName);

          const { error: insertError } = await supabase.from('payment_proofs').insert({
            payment_id: paymentId,
            uploaded_by: user.id,
            uploaded_by_type: 'client',
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            description: description || 'Instructions de paiement',
          });

          if (insertError) throw insertError;

          results.push({ success: true, fileName: file.name });
        } catch (err: any) {
          results.push({ success: false, fileName: file.name, error: err.message });
        }

        completed++;
        setUploadProgress(Math.round((completed / files.length) * 100));
      }

      // Add timeline event if at least one file was uploaded
      const successCount = results.filter((r) => r.success).length;
      if (successCount > 0) {
        await supabase.from('payment_timeline_events').insert({
          payment_id: paymentId,
          event_type: 'instructions_uploaded',
          description: `${successCount} instruction(s) de paiement ajoutée(s) par le client`,
          performed_by: user.id,
        });
      }

      return results;
    },
    onSuccess: (results, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (failCount === 0) {
        toast.success(`${successCount} fichier(s) téléchargé(s) avec succès`);
      } else if (successCount > 0) {
        toast.warning(`${successCount} fichier(s) téléchargé(s), ${failCount} échec(s)`);
      } else {
        toast.error('Échec du téléchargement des fichiers');
      }

      setUploadProgress(0);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setUploadProgress(0);
    },
  });

  return {
    uploadProofs: mutation.mutateAsync,
    isUploading: mutation.isPending,
    uploadProgress,
  };
}

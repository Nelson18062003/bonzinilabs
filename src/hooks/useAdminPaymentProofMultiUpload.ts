import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createSignedUrl } from '@/lib/signedUrls';
import { compressImage } from '@/lib/imageCompression';
import i18n from '@/i18n';

export function useAdminPaymentProofMultiUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      paymentId, 
      files, 
      description 
    }: { 
      paymentId: string; 
      files: File[]; 
      description?: string 
    }) => {
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      if (!user) throw new Error(i18n.t('hooks.auth.notAuthenticated', { ns: 'common', defaultValue: 'Non authentifié' }));

      const results = [];
      
      for (const rawFile of files) {
        const file = await compressImage(rawFile);
        const filePath = `admin/${paymentId}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, file);

        if (uploadError) {
          console.error(`Failed to upload ${rawFile.name}:`, uploadError);
          continue;
        }

        const storedPath = `payment-proofs/${filePath}`;

        const { error } = await supabaseAdmin.from('payment_proofs').insert({
          payment_id: paymentId,
          uploaded_by: user.id,
          uploaded_by_type: 'admin',
          file_name: file.name,
          file_url: storedPath,
          file_type: file.type,
          description,
        });

        if (!error) {
          results.push({ file: file.name, success: true });
        } else {
          results.push({ file: file.name, success: false, error });
        }
      }

      // Add single timeline event for all uploads
      if (results.some(r => r.success)) {
        const successCount = results.filter(r => r.success).length;
        await supabaseAdmin.from('payment_timeline_events').insert({
          payment_id: paymentId,
          event_type: 'proof_uploaded',
          description: successCount > 1 
            ? `${successCount} preuves de paiement ajoutées par Bonzini`
            : 'Preuve de paiement ajoutée par Bonzini',
          performed_by: user.id,
        });
      }

      return results;
    },
    onSuccess: (results, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (successCount > 0 && failCount === 0) {
        toast.success(successCount > 1
          ? i18n.t('hooks.adminProofMultiUpload.successMultiple', { ns: 'common', defaultValue: `${successCount} preuves téléchargées`, count: successCount })
          : i18n.t('hooks.uploadProof.success', { ns: 'common', defaultValue: 'Preuve téléchargée' })
        );
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(i18n.t('hooks.adminProofMultiUpload.partialSuccess', { ns: 'common', defaultValue: `${successCount} réussie(s), ${failCount} échec(s)`, successCount, failCount }));
      } else {
        toast.error(i18n.t('hooks.adminProofMultiUpload.allFailed', { ns: 'common', defaultValue: 'Échec du téléchargement' }));
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

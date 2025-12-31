import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const results = [];
      
      for (const file of files) {
        const fileName = `admin/${paymentId}/${Date.now()}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(fileName, file);

        if (uploadError) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(fileName);

        const { error } = await supabase.from('payment_proofs').insert({
          payment_id: paymentId,
          uploaded_by: user.id,
          uploaded_by_type: 'admin',
          file_name: file.name,
          file_url: publicUrl,
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
        await supabase.from('payment_timeline_events').insert({
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
          ? `${successCount} preuves téléchargées` 
          : 'Preuve téléchargée'
        );
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`${successCount} réussie(s), ${failCount} échec(s)`);
      } else {
        toast.error('Échec du téléchargement');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

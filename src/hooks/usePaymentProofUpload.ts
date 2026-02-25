import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';

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

      for (const rawFile of files) {
        try {
          const file = await compressImage(rawFile);
          const filePath = `instructions/${paymentId}/${Date.now()}_${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Store the file path for later signed URL generation
          const storedPath = `payment-proofs/${filePath}`;

          const { error: insertError } = await supabase.from('payment_proofs').insert({
            payment_id: paymentId,
            uploaded_by: user.id,
            uploaded_by_type: 'client',
            file_name: file.name,
            file_url: storedPath,
            file_type: file.type,
            description: description || 'Instructions de paiement',
          });

          if (insertError) throw insertError;

          results.push({ success: true, fileName: rawFile.name });
        } catch (err: any) {
          results.push({ success: false, fileName: rawFile.name, error: err.message });
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

/**
 * Hook for admin to upload payment proof (e.g., proof of completed payment)
 */
export function useAdminPaymentProofUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      file,
      description,
    }: {
      paymentId: string;
      file: File;
      description?: string;
    }) => {
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const compressedFile = await compressImage(file);
      const filePath = `proofs/${paymentId}/${Date.now()}_${compressedFile.name}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('payment-proofs')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      // Store the file path for later signed URL generation
      const storedPath = `payment-proofs/${filePath}`;

      const { error: insertError } = await supabaseAdmin.from('payment_proofs').insert({
        payment_id: paymentId,
        uploaded_by: user.id,
        uploaded_by_type: 'admin',
        file_name: compressedFile.name,
        file_url: storedPath,
        file_type: compressedFile.type,
        description: description || 'Preuve de paiement Bonzini',
      });

      if (insertError) throw insertError;

      // Add timeline event
      await supabaseAdmin.from('payment_timeline_events').insert({
        payment_id: paymentId,
        event_type: 'proof_uploaded',
        description: 'Preuve de paiement ajoutée par Bonzini',
        performed_by: user.id,
      });

      return { success: true };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-proofs', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-timeline', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment', variables.paymentId] });
      toast.success('Preuve ajoutée');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Hook for admin to upload payment instructions (QR codes, bank info, etc.)
 * Stored with uploaded_by_type = 'admin_instruction' to distinguish from client instructions.
 */
export function useAdminUploadPaymentInstruction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      files,
    }: {
      paymentId: string;
      files: File[];
    }) => {
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      let successCount = 0;

      for (const rawFile of files) {
        const file = await compressImage(rawFile);
        const filePath = `instructions/${paymentId}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const storedPath = `payment-proofs/${filePath}`;

        const { error: insertError } = await supabaseAdmin.from('payment_proofs').insert({
          payment_id: paymentId,
          uploaded_by: user.id,
          uploaded_by_type: 'admin_instruction',
          file_name: file.name,
          file_url: storedPath,
          file_type: file.type,
          description: 'Instructions de paiement (admin)',
        });

        if (insertError) throw insertError;
        successCount++;
      }

      if (successCount > 0) {
        await supabaseAdmin.from('payment_timeline_events').insert({
          payment_id: paymentId,
          event_type: 'instructions_uploaded',
          description: `${successCount} instruction(s) ajoutée(s) par l'admin`,
          performed_by: user.id,
        });
      }

      return { success: true, count: successCount };
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-proofs', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-proofs', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['payment-timeline', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-timeline', variables.paymentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment', variables.paymentId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

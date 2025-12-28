import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DepositMethod, DepositStatus } from './useDeposits';

// Fetch all clients for selection
export function useAllClients() {
  return useQuery({
    queryKey: ['all-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('first_name', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export interface AdminCreateDepositData {
  user_id: string;
  amount_xaf: number;
  method: DepositMethod;
  bank_name?: string;
  agency_name?: string;
  client_phone?: string;
  admin_comment?: string;
  proofFiles?: File[];
  deposit_date?: Date; // Optional custom date for the deposit
}

// Helper to get current user
async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export function useAdminCreateDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AdminCreateDepositData) => {
      const admin = await getCurrentUser();
      if (!admin) throw new Error('Vous devez être connecté');

      // Generate reference
      const { data: reference, error: refError } = await supabase.rpc('generate_deposit_reference');
      if (refError) throw refError;

      // Determine initial status based on proofs
      const initialStatus: DepositStatus = data.proofFiles && data.proofFiles.length > 0 
        ? 'proof_submitted' 
        : 'created';

      // Create deposit for the selected client
      const insertData = {
        user_id: data.user_id,
        reference: reference as string,
        amount_xaf: data.amount_xaf,
        method: data.method,
        bank_name: data.bank_name || null,
        agency_name: data.agency_name || null,
        client_phone: data.client_phone || null,
        admin_comment: data.admin_comment || null,
        status: initialStatus,
        created_at: data.deposit_date ? data.deposit_date.toISOString() : new Date().toISOString(),
      };

      const { data: deposit, error } = await supabase
        .from('deposits')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Add timeline event for creation
      await supabase.from('deposit_timeline_events').insert({
        deposit_id: deposit.id,
        event_type: 'created',
        description: 'Dépôt déclaré par l\'équipe Bonzini',
        performed_by: admin.id,
      });

      // Upload proofs if any
      if (data.proofFiles && data.proofFiles.length > 0) {
        for (const file of data.proofFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${data.user_id}/${deposit.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('deposit-proofs')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('deposit-proofs')
            .getPublicUrl(fileName);

          // Create proof record
          await supabase.from('deposit_proofs').insert({
            deposit_id: deposit.id,
            file_url: publicUrl,
            file_name: file.name,
            file_type: file.type,
          });
        }

        // Add timeline event for proofs
        await supabase.from('deposit_timeline_events').insert({
          deposit_id: deposit.id,
          event_type: 'proof_submitted',
          description: `${data.proofFiles.length} preuve(s) ajoutée(s) par l'admin`,
          performed_by: admin.id,
        });
      }

      // Add audit log
      await supabase.from('admin_audit_logs').insert({
        admin_user_id: admin.id,
        action_type: 'create_deposit_for_client',
        target_type: 'deposit',
        target_id: deposit.id,
        details: {
          client_user_id: data.user_id,
          amount_xaf: data.amount_xaf,
          method: data.method,
          proofs_count: data.proofFiles?.length || 0,
        },
      });

      return deposit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['my-deposits'] });
      toast.success('Dépôt créé avec succès');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });
}

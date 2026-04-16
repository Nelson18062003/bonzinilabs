import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import i18n from '@/i18n';

export interface Beneficiary {
  id: string;
  client_id: string;
  payment_method: 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
  name: string;
  identifier: string | null;
  identifier_type: 'qr' | 'id' | 'email' | 'phone' | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_extra: string | null;
  qr_code_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBeneficiaryData {
  payment_method: 'alipay' | 'wechat' | 'bank_transfer' | 'cash';
  name: string;
  identifier?: string;
  identifier_type?: 'qr' | 'id' | 'email' | 'phone';
  phone?: string;
  email?: string;
  bank_name?: string;
  bank_account?: string;
  bank_extra?: string;
  qr_code_file?: File;
}

// ── Client hooks (use supabase) ──────────────────────────────

/** List beneficiaries for the connected client, optionally filtered by method */
export function useBeneficiaries(method?: Beneficiary['payment_method']) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-beneficiaries', user?.id, method],
    queryFn: async () => {
      let query = supabase
        .from('beneficiaries')
        .select('*')
        .eq('client_id', user!.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (method) {
        query = query.eq('payment_method', method);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Generate signed URLs for QR codes
      const results = await Promise.all(
        (data as Beneficiary[]).map(async (b) => {
          if (b.qr_code_url?.startsWith('payment-proofs/')) {
            const storagePath = b.qr_code_url.replace('payment-proofs/', '');
            const { data: signedData } = await supabase.storage
              .from('payment-proofs')
              .createSignedUrl(storagePath, 3600);
            return { ...b, qr_code_url: signedData?.signedUrl || b.qr_code_url };
          }
          return b;
        })
      );

      return results;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Create a new beneficiary for the connected client */
export function useCreateBeneficiary() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateBeneficiaryData) => {
      let qrCodeUrl: string | null = null;

      if (data.qr_code_file) {
        const compressed = await compressImage(data.qr_code_file);
        const filePath = `beneficiary-qr/${user!.id}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, compressed);
        if (uploadError) throw uploadError;
        qrCodeUrl = `payment-proofs/${filePath}`;
      }

      const { data: result, error } = await supabase
        .from('beneficiaries')
        .insert({
          client_id: user!.id,
          payment_method: data.payment_method,
          name: data.name,
          identifier: data.identifier || null,
          identifier_type: data.identifier_type || null,
          phone: data.phone || null,
          email: data.email || null,
          bank_name: data.bank_name || null,
          bank_account: data.bank_account || null,
          bank_extra: data.bank_extra || null,
          qr_code_url: qrCodeUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return result as Beneficiary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-beneficiaries'] });
      toast.success(i18n.t('hooks.createBeneficiary.success', { ns: 'common', defaultValue: 'Bénéficiaire ajouté' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.createBeneficiary.error', { ns: 'common', defaultValue: "Erreur lors de l'ajout" }));
    },
  });
}

/** Update an existing beneficiary */
export function useUpdateBeneficiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      beneficiaryId,
      updates,
      qrCodeFile,
    }: {
      beneficiaryId: string;
      updates: Partial<Pick<Beneficiary, 'name' | 'identifier' | 'identifier_type' | 'phone' | 'email' | 'bank_name' | 'bank_account' | 'bank_extra'>>;
      qrCodeFile?: File;
    }) => {
      const updateData: Record<string, unknown> = { ...updates };

      if (qrCodeFile) {
        const { data: { user } } = await supabase.auth.getUser();
        const compressed = await compressImage(qrCodeFile);
        const filePath = `beneficiary-qr/${user!.id}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, compressed);
        if (uploadError) throw uploadError;
        updateData.qr_code_url = `payment-proofs/${filePath}`;
      }

      const { error } = await supabase
        .from('beneficiaries')
        .update(updateData)
        .eq('id', beneficiaryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-beneficiaries'] });
      toast.success(i18n.t('hooks.updateBeneficiary.success', { ns: 'common', defaultValue: 'Bénéficiaire mis à jour' }));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ── Admin hooks (use supabaseAdmin) ──────────────────────────

/** Admin: list beneficiaries for a specific client */
export function useAdminClientBeneficiaries(clientId: string | undefined, method?: Beneficiary['payment_method']) {
  return useQuery({
    queryKey: ['admin-client-beneficiaries', clientId, method],
    queryFn: async () => {
      let query = supabaseAdmin
        .from('beneficiaries')
        .select('*')
        .eq('client_id', clientId!)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (method) {
        query = query.eq('payment_method', method);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Generate signed URLs for QR codes
      const results = await Promise.all(
        (data as Beneficiary[]).map(async (b) => {
          if (b.qr_code_url?.startsWith('payment-proofs/')) {
            const storagePath = b.qr_code_url.replace('payment-proofs/', '');
            const { data: signedData } = await supabaseAdmin.storage
              .from('payment-proofs')
              .createSignedUrl(storagePath, 3600);
            return { ...b, qr_code_url: signedData?.signedUrl || b.qr_code_url };
          }
          return b;
        })
      );

      return results;
    },
    enabled: !!clientId,
    staleTime: 30_000,
    retry: 1,
  });
}

/** Admin: create a beneficiary for a client */
export function useAdminCreateBeneficiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateBeneficiaryData & { client_id: string }) => {
      let qrCodeUrl: string | null = null;

      if (data.qr_code_file) {
        const compressed = await compressImage(data.qr_code_file);
        const filePath = `beneficiary-qr/${data.client_id}/${Date.now()}_${compressed.name}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('payment-proofs')
          .upload(filePath, compressed);
        if (uploadError) throw uploadError;
        qrCodeUrl = `payment-proofs/${filePath}`;
      }

      const { data: result, error } = await supabaseAdmin
        .from('beneficiaries')
        .insert({
          client_id: data.client_id,
          payment_method: data.payment_method,
          name: data.name,
          identifier: data.identifier || null,
          identifier_type: data.identifier_type || null,
          phone: data.phone || null,
          email: data.email || null,
          bank_name: data.bank_name || null,
          bank_account: data.bank_account || null,
          bank_extra: data.bank_extra || null,
          qr_code_url: qrCodeUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return result as Beneficiary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-client-beneficiaries'] });
      toast.success(i18n.t('hooks.createBeneficiary.success', { ns: 'common', defaultValue: 'Bénéficiaire ajouté' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.createBeneficiary.error', { ns: 'common', defaultValue: "Erreur lors de l'ajout" }));
    },
  });
}

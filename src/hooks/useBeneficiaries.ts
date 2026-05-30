import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import i18n from '@/i18n';
import type {
  BeneficiaryMode,
  IdentifierType,
  RelationType,
} from '@/lib/beneficiaries/spec';

// ============================================================
// Beneficiaries data layer (Lot 2).
//
// One consolidated module for BOTH apps:
//   * client hooks  → `supabase`       (RLS: auth.uid() = client_id)
//   * admin hooks   → `supabaseAdmin`  (RLS: is_admin(), scoped by client_id)
//
// "Delete" is ARCHIVE (is_active = false): reversible, and never touches
// past payments (they hold a frozen snapshot). A Postgres unique
// violation (23505) from the partial UNIQUE indexes is surfaced as a
// friendly "duplicate" error key.
// ============================================================

export interface Beneficiary {
  id: string;
  client_id: string;
  payment_method: BeneficiaryMode;
  alias: string;
  name: string;
  identifier: string | null;
  identifier_type: IdentifierType | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_extra: string | null;
  qr_code_url: string | null;
  relation_type: RelationType | null;
  notes: string | null;
  created_by: string | null;
  created_by_role: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBeneficiaryData {
  payment_method: BeneficiaryMode;
  alias: string;
  name: string;
  identifier?: string | null;
  identifier_type?: IdentifierType | null;
  phone?: string | null;
  email?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_extra?: string | null;
  relation_type?: RelationType | null;
  notes?: string | null;
  qr_code_file?: File;
}

export type UpdateBeneficiaryFields = Partial<
  Pick<
    Beneficiary,
    | 'alias'
    | 'name'
    | 'identifier'
    | 'identifier_type'
    | 'phone'
    | 'email'
    | 'bank_name'
    | 'bank_account'
    | 'bank_extra'
    | 'relation_type'
    | 'notes'
  >
>;

const QR_BUCKET = 'payment-proofs';

// ── Shared helpers ───────────────────────────────────────────

/** Translate a thrown error, mapping the unique-index violation to a
 *  friendly "already saved" message. */
function beneficiaryErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === '23505') {
    return i18n.t('beneficiaries.duplicate.title', {
      ns: 'client',
      defaultValue: 'Bénéficiaire déjà enregistré',
    });
  }
  const message = (error as { message?: string })?.message;
  return (
    message ||
    i18n.t('hooks.createBeneficiary.error', { ns: 'common', defaultValue: "Erreur lors de l'ajout" })
  );
}

/** Upload a QR image (compressed) under a client folder, return the
 *  storage path we persist (signed on read). */
async function uploadQr(
  client: typeof supabase | typeof supabaseAdmin,
  clientId: string,
  file: File,
): Promise<string> {
  const compressed = await compressImage(file);
  const filePath = `beneficiary-qr/${clientId}/${Date.now()}_${compressed.name}`;
  const { error } = await client.storage.from(QR_BUCKET).upload(filePath, compressed);
  if (error) throw error;
  return `${QR_BUCKET}/${filePath}`;
}

/** Replace stored QR paths with short-lived signed URLs for display. */
async function withSignedQr<T extends { qr_code_url: string | null }>(
  client: typeof supabase | typeof supabaseAdmin,
  rows: T[],
): Promise<T[]> {
  return Promise.all(
    rows.map(async (b) => {
      if (b.qr_code_url?.startsWith(`${QR_BUCKET}/`)) {
        const storagePath = b.qr_code_url.replace(`${QR_BUCKET}/`, '');
        const { data: signed } = await client.storage
          .from(QR_BUCKET)
          .createSignedUrl(storagePath, 3600);
        return { ...b, qr_code_url: signed?.signedUrl || b.qr_code_url };
      }
      return b;
    }),
  );
}

/** Build the INSERT payload shared by client + admin create. */
function buildInsertRow(
  data: CreateBeneficiaryData,
  clientId: string,
  qrCodeUrl: string | null,
  createdBy: string | null,
  createdByRole: 'client' | 'admin',
) {
  return {
    client_id: clientId,
    payment_method: data.payment_method,
    alias: data.alias,
    name: data.name,
    identifier: data.identifier || null,
    identifier_type: data.identifier_type || null,
    phone: data.phone || null,
    email: data.email || null,
    bank_name: data.bank_name || null,
    bank_account: data.bank_account || null,
    bank_extra: data.bank_extra || null,
    relation_type: data.relation_type || null,
    notes: data.notes || null,
    qr_code_url: qrCodeUrl,
    created_by: createdBy,
    created_by_role: createdByRole,
  };
}

// ── Client hooks (supabase) ──────────────────────────────────

/** List the connected client's active beneficiaries, optionally by mode. */
export function useBeneficiaries(method?: BeneficiaryMode) {
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
      if (method) query = query.eq('payment_method', method);

      const { data, error } = await query;
      if (error) throw error;
      return withSignedQr(supabase, data as Beneficiary[]);
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateBeneficiary() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateBeneficiaryData) => {
      const qrCodeUrl = data.qr_code_file
        ? await uploadQr(supabase, user!.id, data.qr_code_file)
        : null;
      const { data: result, error } = await supabase
        .from('beneficiaries')
        .insert(buildInsertRow(data, user!.id, qrCodeUrl, user!.id, 'client'))
        .select()
        .single();
      if (error) throw error;
      return result as Beneficiary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-beneficiaries'] });
      toast.success(
        i18n.t('hooks.createBeneficiary.success', { ns: 'common', defaultValue: 'Bénéficiaire ajouté' }),
      );
    },
    onError: (error: unknown) => toast.error(beneficiaryErrorMessage(error)),
  });
}

export function useUpdateBeneficiary() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      beneficiaryId,
      updates,
      qrCodeFile,
    }: {
      beneficiaryId: string;
      updates: UpdateBeneficiaryFields;
      qrCodeFile?: File;
    }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (qrCodeFile) updateData.qr_code_url = await uploadQr(supabase, user!.id, qrCodeFile);

      const { error } = await supabase
        .from('beneficiaries')
        .update(updateData)
        .eq('id', beneficiaryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-beneficiaries'] });
      toast.success(
        i18n.t('hooks.updateBeneficiary.success', { ns: 'common', defaultValue: 'Bénéficiaire mis à jour' }),
      );
    },
    onError: (error: unknown) => toast.error(beneficiaryErrorMessage(error)),
  });
}

/** Archive (soft-delete) — never affects past payments. */
export function useArchiveBeneficiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (beneficiaryId: string) => {
      const { error } = await supabase
        .from('beneficiaries')
        .update({ is_active: false })
        .eq('id', beneficiaryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-beneficiaries'] });
      toast.success(
        i18n.t('hooks.archiveBeneficiary.success', { ns: 'common', defaultValue: 'Bénéficiaire supprimé' }),
      );
    },
    onError: (error: unknown) => toast.error(beneficiaryErrorMessage(error)),
  });
}

// ── Admin hooks (supabaseAdmin) ──────────────────────────────

/** Admin: list the active beneficiaries of a SPECIFIC client. */
export function useAdminClientBeneficiaries(
  clientId: string | undefined,
  method?: BeneficiaryMode,
) {
  return useQuery({
    queryKey: ['admin-client-beneficiaries', clientId, method],
    queryFn: async () => {
      let query = supabaseAdmin
        .from('beneficiaries')
        .select('*')
        .eq('client_id', clientId!)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
      if (method) query = query.eq('payment_method', method);

      const { data, error } = await query;
      if (error) throw error;
      return withSignedQr(supabaseAdmin, data as Beneficiary[]);
    },
    enabled: !!clientId,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useAdminCreateBeneficiary() {
  const queryClient = useQueryClient();
  const { user } = useAdminAuth();

  return useMutation({
    mutationFn: async (data: CreateBeneficiaryData & { client_id: string }) => {
      const qrCodeUrl = data.qr_code_file
        ? await uploadQr(supabaseAdmin, data.client_id, data.qr_code_file)
        : null;
      const { data: result, error } = await supabaseAdmin
        .from('beneficiaries')
        .insert(buildInsertRow(data, data.client_id, qrCodeUrl, user?.id ?? null, 'admin'))
        .select()
        .single();
      if (error) throw error;
      return result as Beneficiary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-client-beneficiaries'] });
      toast.success(
        i18n.t('hooks.createBeneficiary.success', { ns: 'common', defaultValue: 'Bénéficiaire ajouté' }),
      );
    },
    onError: (error: unknown) => toast.error(beneficiaryErrorMessage(error)),
  });
}

export function useAdminUpdateBeneficiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      beneficiaryId,
      clientId,
      updates,
      qrCodeFile,
    }: {
      beneficiaryId: string;
      clientId: string;
      updates: UpdateBeneficiaryFields;
      qrCodeFile?: File;
    }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (qrCodeFile) updateData.qr_code_url = await uploadQr(supabaseAdmin, clientId, qrCodeFile);

      const { error } = await supabaseAdmin
        .from('beneficiaries')
        .update(updateData)
        .eq('id', beneficiaryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-client-beneficiaries'] });
      toast.success(
        i18n.t('hooks.updateBeneficiary.success', { ns: 'common', defaultValue: 'Bénéficiaire mis à jour' }),
      );
    },
    onError: (error: unknown) => toast.error(beneficiaryErrorMessage(error)),
  });
}

export function useAdminArchiveBeneficiary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (beneficiaryId: string) => {
      const { error } = await supabaseAdmin
        .from('beneficiaries')
        .update({ is_active: false })
        .eq('id', beneficiaryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-client-beneficiaries'] });
      toast.success(
        i18n.t('hooks.archiveBeneficiary.success', { ns: 'common', defaultValue: 'Bénéficiaire supprimé' }),
      );
    },
    onError: (error: unknown) => toast.error(beneficiaryErrorMessage(error)),
  });
}

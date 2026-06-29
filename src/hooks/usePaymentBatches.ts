/**
 * Bulk payments (paiements groupés) — admin data layer.
 *
 * A "batch" groups several real payments (one per beneficiary, mixed methods)
 * paid together from ONE client's wallet. Creation is atomic + all-or-nothing
 * via the create_payment_batch RPC (single wallet lock, single balance check).
 * Each line is a normal payment afterwards, so the rest of the payment module
 * (process / proofs / receipt / refund-per-line) keeps working unchanged.
 *
 * Admin context → ALWAYS supabaseAdmin (never supabase).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import i18n from '@/i18n';
import type { Json } from '@/integrations/supabase/types';

export type PaymentMethod = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

/** One beneficiary line of a bulk payment. */
export interface PaymentBatchLineInput {
  method: PaymentMethod;
  amount_xaf: number;
  amount_rmb: number;
  exchange_rate: number;
  rate_is_custom?: boolean;
  beneficiary_name?: string;
  beneficiary_phone?: string;
  beneficiary_email?: string;
  beneficiary_qr_code_url?: string;
  beneficiary_bank_name?: string;
  beneficiary_bank_account?: string;
  beneficiary_bank_extra?: string;
  beneficiary_notes?: string;
  beneficiary_identifier?: string;
  beneficiary_identifier_type?: 'qr' | 'id' | 'email' | 'phone';
  beneficiary_id?: string;
  beneficiary_details?: Record<string, unknown>;
  client_visible_comment?: string;
  /** Optional QR images: the first becomes the beneficiary QR, the rest are attached as proofs. */
  qr_code_files?: File[];
}

export interface CreatePaymentBatchInput {
  user_id: string;
  note?: string;
  lines: PaymentBatchLineInput[];
}

export interface CreatePaymentBatchResult {
  success: boolean;
  error?: string;
  batch_id?: string;
  batch_reference?: string;
  line_count?: number;
  total_amount_xaf?: number;
  total_amount_rmb?: number;
  new_balance?: number;
  payment_ids?: string[];
}

const t = (key: string, fallback: string) =>
  i18n.t(key, { ns: 'common', defaultValue: fallback });

/** Drop empty strings so the RPC stores NULLs, not ''. */
function clean(v?: string): string | undefined {
  const s = (v ?? '').trim();
  return s.length > 0 ? s : undefined;
}

/**
 * Create a bulk payment: pre-uploads each line's QR (if a File was supplied),
 * builds the JSONB line array, calls the atomic RPC, then attaches any extra
 * per-line proof images to the created payments (mapped by line order).
 */
export function useCreatePaymentBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePaymentBatchInput): Promise<CreatePaymentBatchResult> => {
      if (!data.lines.length) {
        throw new Error(t('hooks.createBatch.empty', 'Au moins un bénéficiaire est requis'));
      }

      // 1) Pre-upload the primary QR of each line; keep extra files for step 3.
      const extraFilesByIndex: Record<number, File[]> = {};
      const lines: Record<string, unknown>[] = [];

      for (let i = 0; i < data.lines.length; i++) {
        const line = data.lines[i];
        let qrUrl = line.beneficiary_qr_code_url;

        if (line.qr_code_files && line.qr_code_files.length > 0) {
          const compressed = await compressImage(line.qr_code_files[0]);
          const filePath = `qr-codes/${data.user_id}/${Date.now()}_${i}_${compressed.name}`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from('payment-proofs')
            .upload(filePath, compressed);
          if (uploadError) throw uploadError;
          qrUrl = `payment-proofs/${filePath}`;
          if (line.qr_code_files.length > 1) extraFilesByIndex[i] = line.qr_code_files.slice(1);
        }

        lines.push({
          method: line.method,
          amount_xaf: line.amount_xaf,
          amount_rmb: line.amount_rmb,
          exchange_rate: line.exchange_rate,
          rate_is_custom: line.rate_is_custom ?? false,
          beneficiary_name: clean(line.beneficiary_name),
          beneficiary_phone: clean(line.beneficiary_phone),
          beneficiary_email: clean(line.beneficiary_email),
          beneficiary_qr_code_url: clean(qrUrl),
          beneficiary_bank_name: clean(line.beneficiary_bank_name),
          beneficiary_bank_account: clean(line.beneficiary_bank_account),
          beneficiary_bank_extra: clean(line.beneficiary_bank_extra),
          beneficiary_notes: clean(line.beneficiary_notes),
          beneficiary_identifier: clean(line.beneficiary_identifier),
          beneficiary_identifier_type: line.beneficiary_identifier_type,
          beneficiary_id: clean(line.beneficiary_id),
          beneficiary_details: line.beneficiary_details,
          client_visible_comment: clean(line.client_visible_comment),
        });
      }

      // 2) Atomic, all-or-nothing creation.
      const { data: result, error } = await supabaseAdmin.rpc('create_payment_batch', {
        p_user_id: data.user_id,
        p_lines: lines as unknown as Json,
        p_note: clean(data.note),
      });
      if (error) throw error;

      const response = result as unknown as CreatePaymentBatchResult;
      if (!response.success) {
        throw new Error(response.error || t('hooks.createBatch.error', 'Erreur lors de la création du paiement groupé'));
      }

      // 3) Attach any extra per-line proof images to the created payments.
      const indices = Object.keys(extraFilesByIndex);
      if (response.payment_ids && indices.length > 0) {
        const { data: auth } = await supabaseAdmin.auth.getUser();
        const uploaderId = auth?.user?.id || '';
        for (const idxStr of indices) {
          const idx = Number(idxStr);
          const paymentId = response.payment_ids[idx];
          if (!paymentId) continue;
          for (const f of extraFilesByIndex[idx]) {
            const compressed = await compressImage(f);
            const filePath = `admin/${paymentId}/${Date.now()}_${compressed.name}`;
            const { error: upErr } = await supabaseAdmin.storage
              .from('payment-proofs')
              .upload(filePath, compressed);
            if (!upErr) {
              await supabaseAdmin.from('payment_proofs').insert([{
                payment_id: paymentId,
                uploaded_by: uploaderId,
                uploaded_by_type: 'admin',
                file_name: compressed.name,
                file_url: `payment-proofs/${filePath}`,
                file_type: compressed.type,
                description: 'QR Code de paiement',
              }]);
            }
          }
        }
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-batches'] });
      queryClient.invalidateQueries({ queryKey: ['all-wallets'] });
      toast.success(t('hooks.createBatch.success', 'Paiement groupé créé avec succès'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/** List of bulk payments (most recent first), optionally scoped to one client. */
export function usePaymentBatches(clientId?: string) {
  return useQuery({
    queryKey: ['admin-payment-batches', clientId ?? 'all'],
    queryFn: async () => {
      let query = supabaseAdmin
        .from('payment_batches')
        .select('*')
        .order('created_at', { ascending: false });
      if (clientId) query = query.eq('user_id', clientId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** One bulk payment with its payment lines (each a real payment). */
export function usePaymentBatch(batchId?: string) {
  return useQuery({
    queryKey: ['admin-payment-batch', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const [{ data: batch, error: batchErr }, { data: lines, error: linesErr }] = await Promise.all([
        supabaseAdmin.from('payment_batches').select('*').eq('id', batchId!).maybeSingle(),
        supabaseAdmin
          .from('payments')
          .select('*')
          .eq('batch_id', batchId!)
          .order('created_at', { ascending: true }),
      ]);
      if (batchErr) throw batchErr;
      if (linesErr) throw linesErr;
      return { batch, lines: lines ?? [] };
    },
  });
}

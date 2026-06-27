/**
 * Batch PDF export of all "processing" (non-cash) payments — shared by the
 * mobile and desktop payments screens. Returns the number of payments exported
 * (0 = nothing to export, so callers can show an "empty" notice); throws on
 * error. Callers own the loading state and toasts.
 */
import { downloadPDF } from '@/lib/pdf/downloadPDF';
import { BatchPaymentsPDF } from '@/lib/pdf/templates/BatchPaymentsPDF';
import type { BatchPaymentEntry } from '@/lib/pdf/templates/BatchPaymentsPDF';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { signStored } from '@/lib/signedUrls';

export async function exportPendingPaymentsPDF(): Promise<number> {
  // Columns added by the 20260421* migrations. If they haven't been applied to
  // the remote DB yet, PostgREST returns an error complaining about the unknown
  // column. Detect that and retry with the legacy column set so the export keeps
  // working while the migration catches up.
  const LEGACY_COLUMNS =
    'id, reference, amount_rmb, method, created_at, beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_bank_name, beneficiary_bank_account, beneficiary_qr_code_url, beneficiary_notes';
  const EXTENDED_COLUMNS = `${LEGACY_COLUMNS}, beneficiary_bank_extra, beneficiary_identifier`;

  type PaymentRow = {
    id: string;
    reference: string;
    amount_rmb: number;
    method: string;
    created_at: string | null;
    beneficiary_name: string | null;
    beneficiary_phone: string | null;
    beneficiary_email: string | null;
    beneficiary_bank_name: string | null;
    beneficiary_bank_account: string | null;
    beneficiary_qr_code_url: string | null;
    beneficiary_notes: string | null;
    beneficiary_bank_extra?: string | null;
    beneficiary_identifier?: string | null;
  };

  const runSelect = async (columns: string) =>
    supabaseAdmin
      .from('payments')
      .select(columns)
      .eq('status', 'processing')
      .neq('method', 'cash');

  let payments: PaymentRow[] | null = null;
  {
    const res = await runSelect(EXTENDED_COLUMNS);
    if (res.error) {
      const missingColumn =
        res.error.code === '42703' || /column .* does not exist/i.test(res.error.message || '');
      if (!missingColumn) throw res.error;
      const fallback = await runSelect(LEGACY_COLUMNS);
      if (fallback.error) throw fallback.error;
      payments = fallback.data as unknown as PaymentRow[];
    } else {
      payments = res.data as unknown as PaymentRow[];
    }
  }

  if (!payments || payments.length === 0) return 0;

  // Generate signed URLs for QR codes (heals raw paths AND stored signed/public URLs).
  const entries: BatchPaymentEntry[] = await Promise.all(
    payments.map(async (p) => {
      const qrUrl = await signStored(supabaseAdmin.storage, p.beneficiary_qr_code_url);
      return {
        id: p.id,
        reference: p.reference,
        amount_rmb: p.amount_rmb,
        method: p.method,
        created_at: p.created_at,
        beneficiary_name: p.beneficiary_name,
        beneficiary_phone: p.beneficiary_phone,
        beneficiary_email: p.beneficiary_email,
        beneficiary_bank_name: p.beneficiary_bank_name,
        beneficiary_bank_account: p.beneficiary_bank_account,
        beneficiary_bank_extra: p.beneficiary_bank_extra ?? null,
        beneficiary_qr_code_url: qrUrl,
        beneficiary_notes: p.beneficiary_notes,
        beneficiary_identifier: p.beneficiary_identifier ?? null,
      };
    }),
  );

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  await downloadPDF(
    <BatchPaymentsPDF payments={entries} generatedAt={new Date()} />,
    `Bonzini_Payments_Pending_${dateStr}.pdf`,
  );
  return entries.length;
}

// ============================================================
// Helpers for rendering the receipt PDF from a Payment record.
// Extracted from PaymentDetailPage so the page only orchestrates.
// ============================================================
import type { Payment, PaymentProof } from '@/hooks/usePayments';
import type { PaymentReceiptData } from '@/lib/pdf/templates/PaymentReceiptPDF';

/**
 * Capture the cash QR <svg> currently rendered in the DOM and return
 * a base64 PNG data URL the React-PDF template can embed.
 *
 * Resolves to null when the SVG is missing or the canvas conversion
 * fails — the caller decides whether to skip the QR in the receipt.
 */
export function captureQrDataUrl(paymentId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const svgElement = document.getElementById(`qr-${paymentId}`);
    if (!svgElement) {
      resolve(null);
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  });
}

interface ReceiptInputs {
  payment: Payment;
  clientName: string;
  clientPhone: string | null | undefined;
  clientEmail: string | undefined;
  clientCountry: string | null | undefined;
  cashPaymentQrDataUrl: string | null;
  adminProofs: PaymentProof[];
}

/**
 * Pure builder turning a Payment + supporting context into the
 * PaymentReceiptData shape the PDF template expects.
 */
export function buildReceiptData(inputs: ReceiptInputs): PaymentReceiptData {
  const { payment, clientName, clientPhone, clientEmail, clientCountry, cashPaymentQrDataUrl, adminProofs } = inputs;

  return {
    id: payment.id,
    reference: payment.reference,
    created_at: payment.created_at,
    processed_at: payment.processed_at,
    amount_xaf: payment.amount_xaf,
    amount_rmb: payment.amount_rmb,
    exchange_rate: payment.exchange_rate,
    method: payment.method,
    status: payment.status,
    client_name: clientName,
    client_phone: clientPhone ?? undefined,
    client_email: clientEmail,
    client_country: clientCountry ?? undefined,
    beneficiary_name: payment.beneficiary_name,
    beneficiary_phone: payment.beneficiary_phone,
    beneficiary_email: payment.beneficiary_email,
    beneficiary_bank_name: payment.beneficiary_bank_name,
    beneficiary_bank_account: payment.beneficiary_bank_account,
    beneficiary_qr_code_url: payment.beneficiary_qr_code_url,
    cashPaymentQrDataUrl,
    adminProofs: adminProofs.map((p) => ({
      file_url: p.file_url,
      file_type: p.file_type,
      file_name: p.file_name,
      created_at: p.created_at,
    })),
  };
}

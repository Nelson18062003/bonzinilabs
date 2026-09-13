/**
 * Paiements figés pour le harnais de capture (SCREENSHOT_MOCK=1) : le vrai
 * module est réexporté, seules les lectures admin (liste, détail, preuves,
 * suivi) sont remplacées par des fixtures. Les mutations restent réelles
 * mais ne sont jamais appelées.
 */
export * from '../hooks/usePayments';
import type { Payment, PaymentProof, PaymentTimelineEvent } from '../hooks/usePayments';

type Client = { user_id: string; first_name: string; last_name: string; phone: string | null; company_name: string | null };
const client = (user_id: string, first_name: string, last_name: string, phone: string, company_name: string | null = null): Client =>
  ({ user_id, first_name, last_name, phone, company_name });

const base = {
  beneficiary_name: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null,
  beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_bank_extra: null, beneficiary_notes: null,
  beneficiary_identifier: null, beneficiary_identifier_type: null, cash_qr_code: null,
  cash_beneficiary_type: null, cash_beneficiary_first_name: null, cash_beneficiary_last_name: null, cash_beneficiary_phone: null,
  cash_signature_url: null, cash_signature_timestamp: null, cash_signed_by_name: null, cash_scanned_at: null, cash_paid_at: null,
  processed_by: null, processed_at: null, rejection_reason: null, admin_comment: null, client_visible_comment: null,
  balance_before: 3_000_000, balance_after: 1_550_000, updated_at: '2026-09-13T08:00:00Z',
  beneficiary_id: null, beneficiary_details: null, rate_is_custom: false, exchange_rate: 11530,
} as const;

const PAYMENTS: (Payment & { profiles: Client | null })[] = [
  { ...base, id: 'p1', user_id: 'u1', reference: 'BZ-PY-260913-0210', amount_xaf: 2_602_000, amount_rmb: 30_000, method: 'bank_transfer', status: 'ready_for_payment', created_at: '2026-09-13T07:30:00Z', beneficiary_name: 'Shenzhen Hongfa Trading Co.', beneficiary_bank_name: 'Bank of China', beneficiary_bank_account: '6214 8888 1234 5678', beneficiary_bank_extra: 'SWIFT BKCHCNBJ', profiles: client('u1', 'Jean-Paul', 'Mbarga', '+237 690 11 22 33', 'Mbarga Import') },
  { ...base, id: 'p2', user_id: 'u2', reference: 'BZ-PY-260913-0209', amount_xaf: 433_600, amount_rmb: 5_000, method: 'wechat', status: 'waiting_beneficiary_info', created_at: '2026-09-13T06:50:00Z', profiles: client('u2', 'Aminatou', 'Bello', '+237 655 44 55 66') },
  { ...base, id: 'p3', user_id: 'u5', reference: 'BZ-PY-260913-0204', amount_xaf: 1_450_000, amount_rmb: 16_718, method: 'alipay', status: 'processing', created_at: '2026-09-13T04:05:00Z', beneficiary_name: 'Guangzhou Yite Electronics', beneficiary_phone: '+86 138 0013 8000', beneficiary_identifier: 'yite_gz', beneficiary_identifier_type: 'id', beneficiary_notes: 'Facture n° YT-2609-88, préciser la référence dans le message.', profiles: client('u5', 'Fatou', 'Ndiaye', '+237 690 55 66 77', 'Ndiaye & Fils') },
  { ...base, id: 'p4', user_id: 'u3', reference: 'BZ-PY-260912-0198', amount_xaf: 867_300, amount_rmb: 10_000, method: 'cash', status: 'cash_pending', created_at: '2026-09-12T15:00:00Z', cash_beneficiary_type: 'other', cash_beneficiary_first_name: 'Li', cash_beneficiary_last_name: 'Wei', cash_beneficiary_phone: '+86 139 2200 1100', profiles: client('u3', 'Samuel', 'Nkoulou', '+237 677 88 99 00', 'SN Électronique') },
  { ...base, id: 'p5', user_id: 'u4', reference: 'BZ-PY-260912-0190', amount_xaf: 5_204_000, amount_rmb: 60_000, method: 'bank_transfer', status: 'completed', processed_at: '2026-09-12T12:40:00Z', created_at: '2026-09-12T09:10:00Z', beneficiary_name: 'Foshan Ledi Furniture', beneficiary_bank_name: 'ICBC', beneficiary_bank_account: '9558 8020 0012 3456', profiles: client('u4', 'Rosine', 'Tchoua', '+237 699 12 34 56') },
  { ...base, id: 'p6', user_id: 'u6', reference: 'BZ-PY-260910-0171', amount_xaf: 260_200, amount_rmb: 3_000, method: 'alipay', status: 'rejected', rejection_reason: 'Coordonnées du bénéficiaire introuvables sur Alipay.', created_at: '2026-09-10T11:00:00Z', profiles: client('u6', 'Pierre', 'Essomba', '+237 676 00 11 22') },
];

const PROOF_SVG = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="450" viewBox="0 0 720 450">
<rect width="720" height="450" fill="#eef4ff"/><rect x="0" y="0" width="720" height="64" fill="#1677FF"/>
<text x="24" y="42" font-family="sans-serif" font-size="26" font-weight="700" fill="#fff">Alipay</text>
<text x="24" y="130" font-family="sans-serif" font-size="22" fill="#5a5a5a">Facture du fournisseur</text>
<text x="24" y="190" font-family="sans-serif" font-size="44" font-weight="700" fill="#1e1e1e">¥16 718,00</text>
<text x="24" y="240" font-family="sans-serif" font-size="22" fill="#5a5a5a">Guangzhou Yite Electronics · YT-2609-88</text>
</svg>`);
const PROOF_URL = `data:image/svg+xml;charset=utf-8,${PROOF_SVG}`;

const PROOFS: PaymentProof[] = [
  { id: 'pp1', payment_id: 'p3', uploaded_by: 'u5', uploaded_by_type: 'client', file_name: 'facture-yite-2609-88.png', file_url: PROOF_URL, file_type: 'image/png', description: null, created_at: '2026-09-13T04:06:00Z' },
];

const TIMELINE: PaymentTimelineEvent[] = [
  { id: 'pt1', payment_id: 'p3', event_type: 'created', description: 'Paiement demandé', performed_by: 'u5', created_at: '2026-09-13T04:05:00Z' },
  { id: 'pt2', payment_id: 'p3', event_type: 'processing', description: 'Passé en cours', performed_by: 'admin', created_at: '2026-09-13T05:00:00Z' },
];

const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null, refetch: async () => undefined });

export const useAdminPayments = () => ok(PAYMENTS);
export const useAdminPaymentDetail = (id: string | undefined) => ok(PAYMENTS.find((p) => p.id === id) ?? null);
export const useAdminPaymentProofs = (id: string | undefined) => ok(id === 'p3' ? PROOFS : []);
export const useAdminPaymentTimeline = (id: string | undefined) => ok(id === 'p3' ? TIMELINE : []);

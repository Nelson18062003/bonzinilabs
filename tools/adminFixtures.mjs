// Shared REST/RPC/storage fixtures for the admin screenshot runners.
// Used by shoot-admin-before.mjs (real screens) and shoot-admin.mjs (redesign mockups).
const now = Date.now();
const ago = (h) => new Date(now - h * 3600_000).toISOString();

const clients = [
  { user_id: 'u1', first_name: 'Clarisse', last_name: 'Ngo Bell', phone: '+237 699 21 40 88', company_name: 'CNB Import' },
  { user_id: 'u2', first_name: 'Moussa', last_name: 'Bah', phone: '+237 677 02 33 19', company_name: null },
  { user_id: 'u3', first_name: 'Jean-Paul', last_name: 'Mbarga', phone: '+237 655 71 90 02', company_name: 'Mbarga & Fils' },
  { user_id: 'u4', first_name: 'Aïcha', last_name: 'Diallo', phone: '+237 690 44 12 07', company_name: null },
  { user_id: 'u5', first_name: 'Fatou', last_name: 'Ndiaye', phone: '+237 696 88 45 31', company_name: 'FN Import Sarl' },
  { user_id: 'u6', first_name: 'Ibrahim', last_name: 'Touré', phone: '+237 671 55 08 64', company_name: null },
  { user_id: 'u7', first_name: 'Mariam', last_name: 'Koné', phone: '+237 698 30 77 25', company_name: null },
];

const deposits = [
  { id: 'd1', reference: 'BZ-DP-2026-0838', user_id: 'u1', amount_xaf: 2400000, method: 'bank_transfer', bank_name: 'Afriland First Bank', agency_name: null, status: 'proof_submitted', created_at: ago(11), confirmed_amount_xaf: null, admin_comment: null },
  { id: 'd2', reference: 'BZ-DP-2026-0841', user_id: 'u2', amount_xaf: 780000, method: 'mtn_transfer', bank_name: null, agency_name: null, status: 'proof_submitted', created_at: ago(9), confirmed_amount_xaf: null, admin_comment: null },
  { id: 'd3', reference: 'BZ-DP-2026-0844', user_id: 'u3', amount_xaf: 5100000, method: 'bank_cash', bank_name: 'UBA', agency_name: null, status: 'admin_review', created_at: ago(6), confirmed_amount_xaf: null, admin_comment: null },
  { id: 'd4', reference: 'BZ-DP-2026-0846', user_id: 'u4', amount_xaf: 1250000, method: 'om_withdrawal', bank_name: null, agency_name: null, status: 'proof_submitted', created_at: ago(4), confirmed_amount_xaf: null, admin_comment: null },
  { id: 'd5', reference: 'BZ-DP-2026-0847', user_id: 'u5', amount_xaf: 850000, method: 'om_withdrawal', bank_name: null, agency_name: null, status: 'admin_review', created_at: ago(3), confirmed_amount_xaf: null, admin_comment: '2e dépôt du mois — 1re preuve floue, remplacée.' },
  { id: 'd6', reference: 'BZ-DP-2026-0849', user_id: 'u6', amount_xaf: 3400000, method: 'wave', bank_name: null, agency_name: null, status: 'proof_submitted', created_at: ago(1), confirmed_amount_xaf: null, admin_comment: null },
  { id: 'd7', reference: 'BZ-DP-2026-0851', user_id: 'u7', amount_xaf: 1050000, method: 'agency_cash', bank_name: null, agency_name: 'Douala Bonapriso', status: 'proof_submitted', created_at: ago(0.4), confirmed_amount_xaf: null, admin_comment: null },
];

const depositProofs = [
  { id: 'pr1', deposit_id: 'd5', file_url: 'deposit-proofs/u5/d5/proof-1.pdf', file_name: 'sms-orange-money.pdf', file_type: 'application/pdf', uploaded_at: ago(2.9), uploaded_by: 'u5', uploaded_by_type: 'client', deleted_at: null, is_visible_to_client: true },
  { id: 'pr2', deposit_id: 'd5', file_url: 'deposit-proofs/u5/d5/proof-2.pdf', file_name: 'recu-om.pdf', file_type: 'application/pdf', uploaded_at: ago(2.5), uploaded_by: 'u5', uploaded_by_type: 'client', deleted_at: null, is_visible_to_client: true },
  { id: 'pr3', deposit_id: 'd1', file_url: 'deposit-proofs/u1/d1/v.pdf', file_name: 'virement.pdf', file_type: 'application/pdf', uploaded_at: ago(10), uploaded_by: 'u1', uploaded_by_type: 'client', deleted_at: null, is_visible_to_client: true },
];

const depositTimeline = [
  { id: 't1', deposit_id: 'd5', event_type: 'created', created_at: ago(3.1), metadata: {} },
  { id: 't2', deposit_id: 'd5', event_type: 'proof_submitted', created_at: ago(2.9), metadata: {} },
  { id: 't3', deposit_id: 'd5', event_type: 'admin_review', created_at: ago(2.2), metadata: {} },
];

const payments = [
  { id: 'p1', reference: 'BZ-PY-2026-1192', user_id: 'u3', amount_rmb: 58900, amount_xaf: 5110000, exchange_rate: 11525, rate_is_custom: false, method: 'bank_transfer', status: 'ready_for_payment', created_at: ago(14), beneficiary_name: 'Guangzhou Hongfa Trade', beneficiary_bank_name: 'Bank of China', beneficiary_bank_account: '6214 8802 3391 5588', beneficiary_phone: null, beneficiary_email: null, beneficiary_identifier: null, beneficiary_identifier_type: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p2', reference: 'BZ-PY-2026-1196', user_id: 'u4', amount_rmb: 9210, amount_xaf: 798800, exchange_rate: 11530, rate_is_custom: false, method: 'wechat', status: 'ready_for_payment', created_at: ago(7), beneficiary_name: 'Lin Mei 林梅', beneficiary_identifier: 'linmei_gz88', beneficiary_identifier_type: 'id', beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p3', reference: 'BZ-PY-2026-1204', user_id: 'u5', amount_rmb: 14380, amount_xaf: 1250000, exchange_rate: 11504, rate_is_custom: true, method: 'alipay', status: 'ready_for_payment', created_at: ago(3), beneficiary_name: 'Zhang Wei 张伟', beneficiary_identifier: 'zw88@aliyun.com', beneficiary_identifier_type: 'email', beneficiary_phone: '+86 138 0219 4471', beneficiary_email: null, beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p4', reference: 'BZ-PY-2026-1205', user_id: 'u6', amount_rmb: 23060, amount_xaf: 2000000, exchange_rate: 11530, rate_is_custom: false, method: 'cash', status: 'cash_scanned', created_at: ago(2), beneficiary_name: null, cash_beneficiary_type: 'self', beneficiary_identifier: null, beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p5', reference: 'BZ-PY-2026-1201', user_id: 'u1', amount_rmb: 31120, amount_xaf: 2700000, exchange_rate: 11526, rate_is_custom: false, method: 'alipay', status: 'processing', created_at: ago(5), beneficiary_name: 'Shenzhen Kaida Electronics', beneficiary_identifier: '138 2244 9087', beneficiary_identifier_type: 'id', beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p6', reference: 'BZ-PY-2026-1199', user_id: 'u7', amount_rmb: 120400, amount_xaf: 10450000, exchange_rate: 11522, rate_is_custom: false, method: 'bank_transfer', status: 'completed', created_at: ago(6), beneficiary_name: 'Yiwu Sunrise Import-Export', beneficiary_bank_name: 'Bank of China', beneficiary_bank_account: '6217 0031 8845 0031', beneficiary_phone: null, beneficiary_email: null, beneficiary_identifier: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p7', reference: 'BZ-PY-2026-1188', user_id: 'u2', amount_rmb: 4610, amount_xaf: 400000, exchange_rate: 11530, rate_is_custom: false, method: 'wechat', status: 'waiting_beneficiary_info', created_at: ago(23), beneficiary_name: null, beneficiary_identifier: null, beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
];

const paymentTimeline = [
  { id: 'pt1', payment_id: 'p3', event_type: 'created', created_at: ago(3.1), metadata: {} },
  { id: 'pt2', payment_id: 'p3', event_type: 'ready_for_payment', created_at: ago(3.1), metadata: {} },
];

const wallets = clients.map((c, i) => ({ user_id: c.user_id, balance_xaf: [820000, 145000, 6400000, 990000, 1213450, 2450000, 310000][i] }));

const stats = {
  total: 3214, awaiting_proof: 12, proof_submitted: 5, pending_correction: 2, admin_review: 2,
  validated: 3050, rejected: 143, to_process: 7, today_validated: 12, today_amount: 18200000,
};

function byId(url, list) {
  const m = url.match(/id=eq\.([^&]+)/);
  return m ? (list.filter((x) => x.id === decodeURIComponent(m[1]))) : list;
}

function respond(url) {
  if (url.includes('/rpc/get_deposit_stats')) return stats;
  if (url.includes('/storage/v1/object/sign')) return { signedURL: '/placeholder.svg?sig=1' };
  if (url.includes('/deposit_timeline_events')) return depositTimeline;
  if (url.includes('/deposit_proofs')) {
    const m = url.match(/deposit_id=eq\.([^&]+)/);
    if (m) return depositProofs.filter((p) => p.deposit_id === decodeURIComponent(m[1]));
    return depositProofs;
  }
  if (url.includes('/deposits')) return byId(url, deposits);
  if (url.includes('/payment_timeline_events')) return paymentTimeline;
  if (url.includes('/payment_proofs')) return [];
  if (url.includes('/payments')) return byId(url, payments);
  if (url.includes('/clients')) {
    const m = url.match(/user_id=eq\.([^&]+)/);
    if (m) return clients.filter((c) => c.user_id === decodeURIComponent(m[1]));
    return clients;
  }
  if (url.includes('/wallets')) {
    const m = url.match(/user_id=eq\.([^&]+)/);
    if (m) return wallets.filter((w) => w.user_id === decodeURIComponent(m[1]));
    return wallets;
  }
  if (url.includes('/beneficiaries')) return [];
  if (url.includes('/daily_rates'))
    return [{ id: 'r1', rate_alipay: 11530, rate_wechat: 11530, rate_virement: 11480, rate_cash: 11600, effective_at: ago(6), created_at: ago(6), is_active: true }];
  return [];
}


export { respond };
export function headCount(url) {
  if (url.includes('/deposits')) return 7;
  if (url.includes('/payments')) {
    if (url.includes('status=eq.processing')) return 3;
    if (url.includes('status=eq.completed')) return 5613;
    if (url.includes('status=in.')) return 5;
    return 5872;
  }
  return 0;
}

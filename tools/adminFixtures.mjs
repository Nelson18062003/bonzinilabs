// Shared REST/RPC/storage fixtures for the admin screenshot runners.
// Used by shoot-admin-before.mjs (real screens) and shoot-admin.mjs (redesign mockups).
const now = Date.now();
const ago = (h) => new Date(now - h * 3600_000).toISOString();

const clients = [
  { user_id: 'u1', first_name: 'Clarisse', last_name: 'Ngo Bell', phone: '+237 699 21 40 88', company_name: 'CNB Import', email: 'clarisse@cnbimport.cm', status: 'ACTIVE', city: 'Douala', country: 'Cameroun', utm_source: 'whatsapp', utm_medium: null, utm_campaign: 'flyer-aout', avatar_url: null, created_at: ago(24 * 220), updated_at: ago(5) },
  { user_id: 'u2', first_name: 'Moussa', last_name: 'Bah', phone: '+237 677 02 33 19', company_name: null, email: null, status: 'INACTIVE', city: 'Garoua', country: 'Cameroun', utm_source: null, utm_medium: null, utm_campaign: null, avatar_url: null, created_at: ago(24 * 400), updated_at: ago(24 * 30) },
  { user_id: 'u3', first_name: 'Jean-Paul', last_name: 'Mbarga', phone: '+237 655 71 90 02', company_name: 'Mbarga & Fils', email: 'jp.mbarga@gmail.com', status: 'ACTIVE', city: 'Yaoundé', country: 'Cameroun', utm_source: null, utm_medium: null, utm_campaign: null, avatar_url: null, created_at: ago(24 * 12), updated_at: ago(12) },
  { user_id: 'u4', first_name: 'Aïcha', last_name: 'Diallo', phone: '+237 690 44 12 07', company_name: null, email: 'aicha.d@yahoo.fr', status: 'PENDING_KYC', city: 'N’Djamena', country: 'Tchad', utm_source: 'facebook', utm_medium: null, utm_campaign: null, avatar_url: null, created_at: ago(24 * 6), updated_at: ago(20) },
  { user_id: 'u5', first_name: 'Fatou', last_name: 'Ndiaye', phone: '+237 696 88 45 31', company_name: 'FN Import Sarl', email: 'fatou@fnimport.com', status: 'ACTIVE', city: 'Douala', country: 'Cameroun', utm_source: 'google', utm_medium: 'cpc', utm_campaign: null, avatar_url: null, created_at: ago(24 * 20), updated_at: ago(2) },
  { user_id: 'u6', first_name: 'Ibrahim', last_name: 'Touré', phone: '+237 671 55 08 64', company_name: null, email: null, status: 'SUSPENDED', city: 'Libreville', country: 'Gabon', utm_source: null, utm_medium: null, utm_campaign: null, avatar_url: null, created_at: ago(24 * 310), updated_at: ago(24 * 8) },
  { user_id: 'u7', first_name: 'Mariam', last_name: 'Koné', phone: '+237 698 30 77 25', company_name: null, email: 'mariamk@outlook.com', status: 'ACTIVE', city: 'Douala', country: 'Cameroun', utm_source: 'whatsapp', utm_medium: null, utm_campaign: 'flyer-aout', avatar_url: null, created_at: ago(24 * 3), updated_at: ago(1) },
];

// Grand livre (fiche client desktop — derniers mouvements). Filtré par user_id.
const ledgerEntries = [
  { id: 'le1', wallet_id: 'w5', user_id: 'u5', entry_type: 'DEPOSIT_VALIDATED', amount_xaf: 850000, balance_before: 363450, balance_after: 1213450, reference_type: 'deposit', reference_id: 'd5', description: 'Dépôt BZ-DP-2026-0847 validé', metadata: {}, created_by_admin_id: null, created_at: ago(2.5) },
  { id: 'le2', wallet_id: 'w5', user_id: 'u5', entry_type: 'PAYMENT_RESERVED', amount_xaf: 1250000, balance_before: 1613450, balance_after: 363450, reference_type: 'payment', reference_id: 'p3', description: 'Paiement BZ-PY-2026-1204 (Alipay)', metadata: {}, created_by_admin_id: null, created_at: ago(26) },
  { id: 'le3', wallet_id: 'w5', user_id: 'u5', entry_type: 'ADMIN_CREDIT', amount_xaf: 50000, balance_before: 1563450, balance_after: 1613450, reference_type: null, reference_id: null, description: 'Geste commercial — retard traitement', metadata: {}, created_by_admin_id: 'admin1', created_at: ago(50) },
  { id: 'le4', wallet_id: 'w5', user_id: 'u5', entry_type: 'DEPOSIT_VALIDATED', amount_xaf: 1500000, balance_before: 63450, balance_after: 1563450, reference_type: 'deposit', reference_id: 'd9', description: 'Dépôt BZ-DP-2026-0791 validé', metadata: {}, created_by_admin_id: null, created_at: ago(24 * 4) },
  { id: 'le5', wallet_id: 'w5', user_id: 'u5', entry_type: 'ADMIN_DEBIT', amount_xaf: 20000, balance_before: 83450, balance_after: 63450, reference_type: null, reference_id: null, description: 'Correction double crédit', metadata: {}, created_by_admin_id: 'admin1', created_at: ago(24 * 6) },
];

// Historique des taux (module Taux desktop) — décroissant par effective_at.
const dailyRates = [
  { id: 'r1', rate_cash: 11600, rate_alipay: 11530, rate_wechat: 11530, rate_virement: 11480, effective_at: ago(6), created_at: ago(6), created_by: 'admin1', is_active: true },
  { id: 'r2', rate_cash: 11560, rate_alipay: 11500, rate_wechat: 11500, rate_virement: 11450, effective_at: ago(30), created_at: ago(30), created_by: 'admin1', is_active: false },
  { id: 'r3', rate_cash: 11620, rate_alipay: 11550, rate_wechat: 11540, rate_virement: 11490, effective_at: ago(54), created_at: ago(54), created_by: 'admin1', is_active: false },
  { id: 'r4', rate_cash: 11580, rate_alipay: 11510, rate_wechat: 11510, rate_virement: 11460, effective_at: ago(78), created_at: ago(78), created_by: 'admin1', is_active: false },
  { id: 'r5', rate_cash: 11540, rate_alipay: 11470, rate_wechat: 11470, rate_virement: 11420, effective_at: ago(102), created_at: ago(102), created_by: 'admin1', is_active: false },
  { id: 'r6', rate_cash: 11650, rate_alipay: 11580, rate_wechat: 11570, rate_virement: 11520, effective_at: ago(126), created_at: ago(126), created_by: 'admin1', is_active: false },
  { id: 'r7', rate_cash: 11610, rate_alipay: 11540, rate_wechat: 11530, rate_virement: 11480, effective_at: ago(150), created_at: ago(150), created_by: 'admin1', is_active: false },
  { id: 'r8', rate_cash: 11570, rate_alipay: 11500, rate_wechat: 11490, rate_virement: 11440, effective_at: ago(174), created_at: ago(174), created_by: 'admin1', is_active: false },
  { id: 'r9', rate_cash: 11530, rate_alipay: 11460, rate_wechat: 11450, rate_virement: 11400, effective_at: ago(198), created_at: ago(198), created_by: 'admin1', is_active: false },
  { id: 'r10', rate_cash: 11590, rate_alipay: 11520, rate_wechat: 11510, rate_virement: 11470, effective_at: ago(222), created_at: ago(222), created_by: 'admin1', is_active: false },
];

const rateAdjustments = [
  { id: 'a1', type: 'country', key: 'cameroun', label: 'Cameroun', percentage: 0, is_reference: true, sort_order: 1, updated_at: ago(24), updated_by: null },
  { id: 'a2', type: 'country', key: 'gabon', label: 'Gabon', percentage: -1.5, is_reference: false, sort_order: 2, updated_at: ago(24), updated_by: null },
  { id: 'a3', type: 'country', key: 'tchad', label: 'Tchad', percentage: -2, is_reference: false, sort_order: 3, updated_at: ago(24), updated_by: null },
  { id: 'a4', type: 'country', key: 'rca', label: 'Centrafrique', percentage: -2.5, is_reference: false, sort_order: 4, updated_at: ago(24), updated_by: null },
  { id: 'a5', type: 'country', key: 'congo', label: 'Congo', percentage: -1.5, is_reference: false, sort_order: 5, updated_at: ago(24), updated_by: null },
  { id: 'a6', type: 'country', key: 'guinee', label: 'Guinée Équatoriale', percentage: -3, is_reference: false, sort_order: 6, updated_at: ago(24), updated_by: null },
  { id: 'a7', type: 'tier', key: 't3', label: '≥ 1M XAF', percentage: 0, is_reference: true, sort_order: 1, updated_at: ago(24), updated_by: null },
  { id: 'a8', type: 'tier', key: 't2', label: '400K–999K', percentage: -1, is_reference: false, sort_order: 2, updated_at: ago(24), updated_by: null },
  { id: 'a9', type: 'tier', key: 't1', label: '10K–399K', percentage: -2, is_reference: false, sort_order: 3, updated_at: ago(24), updated_by: null },
];

const rateSuggestions = [
  {
    id: 's1', computed_at: ago(2), cmr_rate_max: 655.2, cmr_margin_xaf: 5,
    cmr_orders: [
      { name: 'CryptoKing237', price: 655.2, tradable: 1450, orders: 812, finishRate: 0.98 },
      { name: 'MboaExchange', price: 654.8, tradable: 3200, orders: 1904, finishRate: 0.99 },
      { name: 'SafeTrade CM', price: 654.1, tradable: 980, orders: 455, finishRate: 0.97 },
      { name: 'DlaCoins', price: 653.9, tradable: 2100, orders: 1210, finishRate: 0.99 },
      { name: 'KmerP2P', price: 653.2, tradable: 760, orders: 340, finishRate: 0.96 },
    ],
    chn_rate_avg: 7.244,
    chn_orders: [
      { name: '广州鑫达', price: 7.25, tradable: 52000, orders: 8812, finishRate: 0.99 },
      { name: 'ShenzhenOTC', price: 7.243, tradable: 88000, orders: 12040, finishRate: 0.99 },
      { name: '义乌汇通', price: 7.239, tradable: 34000, orders: 5230, finishRate: 0.98 },
    ],
    suggested_rate: 11540, method: 'nelson-v2', applied: false, applied_at: null, applied_rate_id: null, applied_by: null,
  },
];

// Les dépôts portent `validated_at` et les paiements `processed_at` : depuis
// que le tableau de bord date les volumes à l'ÉVÉNEMENT (validation /
// exécution) et non à la création, une fixture sans ces colonnes rendrait des
// graphiques vides — et une capture vide se lit comme « rien ce mois-ci », pas
// comme « la fixture est incomplète ». Le harnais doit exiger ce que
// l'application exige.
const deposits = [
  { id: 'd1', reference: 'BZ-DP-2026-0838', user_id: 'u1', amount_xaf: 2400000, method: 'bank_transfer', bank_name: 'Afriland First Bank', agency_name: null, status: 'proof_submitted', created_at: ago(11), validated_at: ago(11 - 0.3), confirmed_amount_xaf: null, admin_comment: null },
  { id: 'd2', reference: 'BZ-DP-2026-0841', user_id: 'u2', amount_xaf: 780000, method: 'mtn_transfer', bank_name: null, agency_name: null, status: 'proof_submitted', created_at: ago(9), validated_at: ago(9 - 0.3), confirmed_amount_xaf: null, admin_comment: null },
  { id: 'd3', reference: 'BZ-DP-2026-0844', user_id: 'u3', amount_xaf: 5100000, method: 'bank_cash', bank_name: 'UBA', agency_name: null, status: 'admin_review', created_at: ago(6), validated_at: ago(6 - 0.3), confirmed_amount_xaf: null, admin_comment: null },
  { id: 'd4', reference: 'BZ-DP-2026-0846', user_id: 'u4', amount_xaf: 1250000, method: 'om_withdrawal', bank_name: null, agency_name: null, status: 'proof_submitted', created_at: ago(4), validated_at: ago(4 - 0.3), confirmed_amount_xaf: null, admin_comment: null },
  { id: 'd5', reference: 'BZ-DP-2026-0847', user_id: 'u5', amount_xaf: 850000, method: 'om_withdrawal', bank_name: null, agency_name: null, status: 'admin_review', created_at: ago(3), validated_at: ago(3 - 0.3), confirmed_amount_xaf: null, admin_comment: '2e dépôt du mois — 1re preuve floue, remplacée.' },
  { id: 'd6', reference: 'BZ-DP-2026-0849', user_id: 'u6', amount_xaf: 3400000, method: 'wave', bank_name: null, agency_name: null, status: 'proof_submitted', created_at: ago(1), validated_at: ago(1 - 0.3), confirmed_amount_xaf: null, admin_comment: null },
  { id: 'd7', reference: 'BZ-DP-2026-0851', user_id: 'u7', amount_xaf: 1050000, method: 'agency_cash', bank_name: null, agency_name: 'Douala Bonapriso', status: 'proof_submitted', created_at: ago(0.4), validated_at: ago(0.4 - 0.3), confirmed_amount_xaf: null, admin_comment: null },
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
  { id: 'p1', reference: 'BZ-PY-2026-1192', user_id: 'u3', amount_rmb: 58900, amount_xaf: 5110000, exchange_rate: 11525, rate_is_custom: false, method: 'bank_transfer', status: 'ready_for_payment', created_at: ago(14), processed_at: ago(14 - 0.2), beneficiary_name: 'Guangzhou Hongfa Trade', beneficiary_bank_name: 'Bank of China', beneficiary_bank_account: '6214 8802 3391 5588', beneficiary_phone: null, beneficiary_email: null, beneficiary_identifier: null, beneficiary_identifier_type: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p2', reference: 'BZ-PY-2026-1196', user_id: 'u4', amount_rmb: 9210, amount_xaf: 798800, exchange_rate: 11530, rate_is_custom: false, method: 'wechat', status: 'ready_for_payment', created_at: ago(7), processed_at: ago(7 - 0.2), beneficiary_name: 'Lin Mei 林梅', beneficiary_identifier: 'linmei_gz88', beneficiary_identifier_type: 'id', beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p3', reference: 'BZ-PY-2026-1204', user_id: 'u5', amount_rmb: 14380, amount_xaf: 1250000, exchange_rate: 11504, rate_is_custom: true, method: 'alipay', status: 'ready_for_payment', created_at: ago(3), processed_at: ago(3 - 0.2), beneficiary_name: 'Zhang Wei 张伟', beneficiary_identifier: 'zw88@aliyun.com', beneficiary_identifier_type: 'email', beneficiary_phone: '+86 138 0219 4471', beneficiary_email: null, beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p4', reference: 'BZ-PY-2026-1205', user_id: 'u6', amount_rmb: 23060, amount_xaf: 2000000, exchange_rate: 11530, rate_is_custom: false, method: 'cash', status: 'cash_scanned', created_at: ago(2), processed_at: ago(2 - 0.2), beneficiary_name: null, cash_beneficiary_type: 'self', beneficiary_identifier: null, beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p5', reference: 'BZ-PY-2026-1201', user_id: 'u1', amount_rmb: 31120, amount_xaf: 2700000, exchange_rate: 11526, rate_is_custom: false, method: 'alipay', status: 'processing', created_at: ago(5), processed_at: ago(5 - 0.2), beneficiary_name: 'Shenzhen Kaida Electronics', beneficiary_identifier: '138 2244 9087', beneficiary_identifier_type: 'id', beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: 'payment-proofs/beneficiary/p5/qr.png', beneficiary_notes: null },
  { id: 'p6', reference: 'BZ-PY-2026-1199', user_id: 'u7', amount_rmb: 120400, amount_xaf: 10450000, exchange_rate: 11522, rate_is_custom: false, method: 'bank_transfer', status: 'completed', created_at: ago(6), processed_at: ago(6 - 0.2), beneficiary_name: 'Yiwu Sunrise Import-Export', beneficiary_bank_name: 'Bank of China', beneficiary_bank_account: '6217 0031 8845 0031', beneficiary_phone: null, beneficiary_email: null, beneficiary_identifier: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p7', reference: 'BZ-PY-2026-1188', user_id: 'u2', amount_rmb: 4610, amount_xaf: 400000, exchange_rate: 11530, rate_is_custom: false, method: 'wechat', status: 'waiting_beneficiary_info', created_at: ago(23), processed_at: ago(23 - 0.2), beneficiary_name: null, beneficiary_identifier: null, beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
];

const paymentTimeline = [
  { id: 'pt1', payment_id: 'p3', event_type: 'created', created_at: ago(3.1), metadata: {} },
  { id: 'pt2', payment_id: 'p3', event_type: 'ready_for_payment', created_at: ago(3.1), metadata: {} },
  { id: 'pt3', payment_id: 'p5', event_type: 'created', created_at: ago(5), metadata: {} },
  { id: 'pt4', payment_id: 'p5', event_type: 'ready_for_payment', created_at: ago(5), metadata: {} },
  { id: 'pt5', payment_id: 'p5', event_type: 'processing', created_at: ago(1.2), metadata: {} },
];

const paymentProofs = [
  { id: 'pp1', payment_id: 'p5', file_url: 'payment-proofs/u1/p5/alipay-transfer.jpg', file_name: 'alipay-transfer.jpg', file_type: 'image/jpeg', uploaded_by: 'admin1', uploaded_by_type: 'admin', created_at: ago(1.1) },
  { id: 'pp4', payment_id: 'p5', file_url: 'payment-proofs/instructions/p5/facture-fournisseur.jpg', file_name: 'facture-fournisseur.jpg', file_type: 'image/jpeg', uploaded_by: 'admin1', uploaded_by_type: 'admin_instruction', created_at: ago(4.8) },
  { id: 'pp2', payment_id: 'p6', file_url: 'payment-proofs/u7/p6/virement-boc.jpg', file_name: 'virement-boc.jpg', file_type: 'image/jpeg', uploaded_by: 'admin1', uploaded_by_type: 'admin', created_at: ago(5.5) },
  { id: 'pp3', payment_id: 'p6', file_url: 'payment-proofs/u7/p6/swift-mt103.pdf', file_name: 'swift-mt103.pdf', file_type: 'application/pdf', uploaded_by: 'admin1', uploaded_by_type: 'admin', created_at: ago(5.4) },
];

// Fake images served for storage GETs by the shoot runners (QR vs proof).
const qrSvg = (() => {
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  let cells = '';
  for (let y = 0; y < 25; y++)
    for (let x = 0; x < 25; x++) {
      const inFinder = (x < 7 && y < 7) || (x > 17 && y < 7) || (x < 7 && y > 17);
      if (!inFinder && rnd() > 0.52) cells += `<rect x="${x + 2}" y="${y + 2}" width="1" height="1"/>`;
    }
  const finder = (fx, fy) =>
    `<rect x="${fx}" y="${fy}" width="7" height="7"/><rect x="${fx + 1}" y="${fy + 1}" width="5" height="5" fill="#fff"/><rect x="${fx + 2}" y="${fy + 2}" width="3" height="3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="29" height="29" fill="#fff"/><g fill="#000">${cells}${finder(2, 2)}${finder(20, 2)}${finder(2, 20)}</g></svg>`;
})();

const proofSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" font-family="sans-serif">
<rect width="640" height="420" fill="#F5F6FA"/><rect x="60" y="30" width="520" height="360" rx="18" fill="#fff"/>
<circle cx="320" cy="100" r="30" fill="#DEEFE5"/><path d="M306 100l10 10 18-20" stroke="#2E7D52" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="320" y="170" text-anchor="middle" font-size="18" fill="#6E6A80">Transfert effectué</text>
<text x="320" y="210" text-anchor="middle" font-size="34" font-weight="bold" fill="#17151F">¥31 120,00</text>
<rect x="120" y="250" width="400" height="10" rx="5" fill="#ECEAF7"/><rect x="120" y="275" width="320" height="10" rx="5" fill="#ECEAF7"/>
<rect x="120" y="300" width="360" height="10" rx="5" fill="#ECEAF7"/><rect x="120" y="340" width="200" height="10" rx="5" fill="#ECEAF7"/>
</svg>`;

const wallets = clients.map((c, i) => ({ user_id: c.user_id, balance_xaf: [820000, 145000, 6400000, 990000, 1213450, 2450000, 310000][i] }));

const stats = {
  total: 3214, awaiting_proof: 12, proof_submitted: 5, pending_correction: 2, admin_review: 2,
  validated: 3050, rejected: 143, to_process: 7, today_validated: 12, today_amount: 18200000,
};

function byId(url, list) {
  // [?&]id=eq. — sans l'ancre, « user_id=eq.u5 » matchait aussi et filtrait
  // par id ('u5') → listes vides et totaux à 0 sur la fiche client.
  const m = url.match(/[?&]id=eq\.([^&]+)/);
  if (m) return list.filter((x) => x.id === decodeURIComponent(m[1]));
  const mu = url.match(/[?&]user_id=eq\.([^&]+)/);
  if (mu) return list.filter((x) => x.user_id === decodeURIComponent(mu[1]));
  return list;
}

function respond(url) {
  if (url.includes('/rpc/get_deposit_stats')) return stats;
  if (url.includes('/storage/v1/object/sign')) {
    // Echo the object path so the GET interception can tell QR from proof.
    const m = url.match(/object\/sign\/([^?]+)/);
    return { signedURL: `/object/fake/${m ? m[1] : 'unknown'}?sig=1` };
  }
  if (url.includes('/deposit_timeline_events')) return depositTimeline;
  if (url.includes('/deposit_proofs')) {
    const m = url.match(/deposit_id=eq\.([^&]+)/);
    if (m) return depositProofs.filter((p) => p.deposit_id === decodeURIComponent(m[1]));
    return depositProofs;
  }
  if (url.includes('/deposits')) return byId(url, deposits);
  if (url.includes('/payment_timeline_events')) {
    const m = url.match(/payment_id=eq\.([^&]+)/);
    return m ? paymentTimeline.filter((t) => t.payment_id === decodeURIComponent(m[1])) : paymentTimeline;
  }
  if (url.includes('/payment_proofs')) {
    const m = url.match(/payment_id=eq\.([^&]+)/);
    return m ? paymentProofs.filter((p) => p.payment_id === decodeURIComponent(m[1])) : paymentProofs;
  }
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
  if (url.includes('/ledger_entries')) {
    const m = url.match(/user_id=eq\.([^&]+)/);
    return m ? ledgerEntries.filter((e) => e.user_id === decodeURIComponent(m[1])) : ledgerEntries;
  }
  if (url.includes('/user_roles')) return [];
  if (url.includes('/rate_adjustments')) return rateAdjustments;
  if (url.includes('/rate_suggestions')) return rateSuggestions;
  if (url.includes('/daily_rates')) {
    if (url.includes('is_active=eq.true')) return dailyRates.filter((r) => r.is_active);
    // Le graphique demande l'ordre croissant ; l'historique le décroissant.
    if (url.includes('order=effective_at.asc')) return [...dailyRates].reverse();
    return dailyRates;
  }
  return [];
}


export { respond, qrSvg, proofSvg };
export function headCount(url) {
  if (url.includes('/deposits')) {
    if (url.includes('status=eq.pending_correction')) return 2;
    if (url.includes('status=in.')) return 7;
    if (url.includes('status=eq.')) return 3;
    return 3214;
  }
  if (url.includes('/payments')) {
    // usePaymentStats issues one eq-count per status — mirror each exactly.
    if (url.includes('status=eq.ready_for_payment')) return 4;
    if (url.includes('status=eq.cash_scanned')) return 1;
    if (url.includes('status=eq.waiting_beneficiary_info')) return 1;
    if (url.includes('status=eq.processing')) return 3;
    if (url.includes('status=eq.completed')) return 5613;
    if (url.includes('status=in.')) return 5;
    return 5872;
  }
  return 0;
}

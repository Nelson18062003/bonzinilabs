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
//
// `verified_at` est le RAPPROCHEMENT BANCAIRE, un axe distinct du statut :
// d2/d5 sont constatés sur le compte, les autres restent à pointer. La
// fixture doit porter les deux cas, sinon la colonne se capture toujours
// dans le même état et ne prouve rien.
const deposits = [
  { id: 'd1', reference: 'BZ-DP-2026-0838', user_id: 'u1', amount_xaf: 2400000, method: 'bank_transfer', bank_name: 'Afriland First Bank', agency_name: null, status: 'proof_submitted', created_at: ago(11), validated_at: ago(11 - 0.3), confirmed_amount_xaf: null, admin_comment: null, verified_at: null, verified_by: null },
  { id: 'd2', reference: 'BZ-DP-2026-0841', user_id: 'u2', amount_xaf: 780000, method: 'mtn_transfer', bank_name: null, agency_name: null, status: 'proof_submitted', created_at: ago(177), validated_at: ago(177 - 0.3), confirmed_amount_xaf: null, admin_comment: null, verified_at: ago(176), verified_by: 'a1' },
  { id: 'd3', reference: 'BZ-DP-2026-0844', user_id: 'u3', amount_xaf: 5100000, method: 'bank_cash', bank_name: 'UBA', agency_name: null, status: 'admin_review', created_at: ago(342), validated_at: ago(342 - 0.3), confirmed_amount_xaf: null, admin_comment: null, verified_at: null, verified_by: null },
  { id: 'd4', reference: 'BZ-DP-2026-0846', user_id: 'u4', amount_xaf: 1250000, method: 'om_withdrawal', bank_name: null, agency_name: null, status: 'proof_submitted', created_at: ago(508), validated_at: ago(508 - 0.3), confirmed_amount_xaf: null, admin_comment: null, verified_at: null, verified_by: null },
  { id: 'd5', reference: 'BZ-DP-2026-0847', user_id: 'u5', amount_xaf: 850000, method: 'om_withdrawal', bank_name: null, agency_name: null, status: 'admin_review', created_at: ago(675), validated_at: ago(675 - 0.3), confirmed_amount_xaf: null, admin_comment: '2e dépôt du mois — 1re preuve floue, remplacée.', verified_at: ago(674), verified_by: 'a1' },
  { id: 'd6', reference: 'BZ-DP-2026-0849', user_id: 'u6', amount_xaf: 3400000, method: 'wave', bank_name: null, agency_name: null, status: 'proof_submitted', created_at: ago(1009), validated_at: ago(1009 - 0.3), confirmed_amount_xaf: null, admin_comment: null, verified_at: null, verified_by: null },
  { id: 'd7', reference: 'BZ-DP-2026-0851', user_id: 'u7', amount_xaf: 1050000, method: 'agency_cash', bank_name: null, agency_name: 'Douala Bonapriso', status: 'proof_submitted', created_at: ago(1346), validated_at: ago(1346 - 0.3), confirmed_amount_xaf: null, admin_comment: null, verified_at: null, verified_by: null },
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
  { id: 'p2', reference: 'BZ-PY-2026-1196', user_id: 'u4', amount_rmb: 9210, amount_xaf: 798800, exchange_rate: 11530, rate_is_custom: false, method: 'wechat', status: 'ready_for_payment', created_at: ago(175), processed_at: ago(175 - 0.2), beneficiary_name: 'Lin Mei 林梅', beneficiary_identifier: 'linmei_gz88', beneficiary_identifier_type: 'id', beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p3', reference: 'BZ-PY-2026-1204', user_id: 'u5', amount_rmb: 14380, amount_xaf: 1250000, exchange_rate: 11504, rate_is_custom: true, method: 'alipay', status: 'ready_for_payment', created_at: ago(339), processed_at: ago(339 - 0.2), beneficiary_name: 'Zhang Wei 张伟', beneficiary_identifier: 'zw88@aliyun.com', beneficiary_identifier_type: 'email', beneficiary_phone: '+86 138 0219 4471', beneficiary_email: null, beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p4', reference: 'BZ-PY-2026-1205', user_id: 'u6', amount_rmb: 23060, amount_xaf: 2000000, exchange_rate: 11530, rate_is_custom: false, method: 'cash', status: 'cash_scanned', created_at: ago(506), processed_at: ago(506 - 0.2), beneficiary_name: null, cash_beneficiary_type: 'self', beneficiary_identifier: null, beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p5', reference: 'BZ-PY-2026-1201', user_id: 'u1', amount_rmb: 31120, amount_xaf: 2700000, exchange_rate: 11526, rate_is_custom: false, method: 'alipay', status: 'processing', created_at: ago(845), processed_at: ago(845 - 0.2), beneficiary_name: 'Shenzhen Kaida Electronics', beneficiary_identifier: '138 2244 9087', beneficiary_identifier_type: 'id', beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: 'payment-proofs/beneficiary/p5/qr.png', beneficiary_notes: null },
  { id: 'p6', reference: 'BZ-PY-2026-1199', user_id: 'u7', amount_rmb: 120400, amount_xaf: 10450000, exchange_rate: 11522, rate_is_custom: false, method: 'bank_transfer', status: 'completed', created_at: ago(1182), processed_at: ago(1182 - 0.2), beneficiary_name: 'Yiwu Sunrise Import-Export', beneficiary_bank_name: 'Bank of China', beneficiary_bank_account: '6217 0031 8845 0031', beneficiary_phone: null, beneficiary_email: null, beneficiary_identifier: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
  { id: 'p7', reference: 'BZ-PY-2026-1188', user_id: 'u2', amount_rmb: 4610, amount_xaf: 400000, exchange_rate: 11530, rate_is_custom: false, method: 'wechat', status: 'waiting_beneficiary_info', created_at: ago(1535), processed_at: ago(1535 - 0.2), beneficiary_name: null, beneficiary_identifier: null, beneficiary_bank_name: null, beneficiary_bank_account: null, beneficiary_phone: null, beneficiary_email: null, beneficiary_qr_code_url: null, beneficiary_notes: null },
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

// Notifications client (page /notifications, cloche, pastille) — user u5.
const notifications = [
  { id: 'n1', user_id: 'u5', type: 'deposit_validated', title: 'Dépôt validé', message: 'Votre dépôt BZ-DP-2026-0841 de 2 500 000 XAF a été crédité.', metadata: { deposit_id: 'd5', reference: 'BZ-DP-2026-0841', amount_xaf: 2500000 }, is_read: false, created_at: ago(2) },
  { id: 'n2', user_id: 'u5', type: 'payment_processing', title: 'Paiement en cours', message: 'Votre règlement BZ-PY-2026-1203 est en cours de traitement.', metadata: { payment_id: 'p3', reference: 'BZ-PY-2026-1203' }, is_read: false, created_at: ago(20) },
  { id: 'n3', user_id: 'u5', type: 'deposit_correction_requested', title: 'Preuve à corriger', message: 'La preuve de votre dépôt est illisible, merci de la renvoyer.', metadata: { deposit_id: 'd5' }, is_read: true, created_at: ago(70) },
  { id: 'n4', user_id: 'u5', type: 'payment_completed', title: 'Fournisseur payé', message: 'Le règlement BZ-PY-2026-1180 de ¥ 12 000 est arrivé chez votre fournisseur.', metadata: { payment_id: 'p1', reference: 'BZ-PY-2026-1180' }, is_read: true, created_at: ago(300) },
];

// ── Opérations v2 : journal, lots de paiements, noms de l'équipe ─────────
// (lus avant le reste : ces requêtes filtrent sur des colonnes que les
// branches génériques plus bas ignorent).
const opsTeam = [
  { user_id: 'admin1', first_name: 'Nelson', last_name: 'Mbappé' },
  { user_id: 'admin2', first_name: 'Christelle', last_name: 'Abena' },
  { user_id: 'admin3', first_name: 'Brice', last_name: 'Fotso' },
];
const opsAuditLogs = [
  { id: 'al1', admin_user_id: 'admin1', action_type: 'validate_deposit', target_type: 'deposit', target_id: 'd5', details: { reference: 'BZ-DP-2026-0847', client_name: 'Fatou Ndiaye' }, created_at: ago(0.4) },
  { id: 'al2', admin_user_id: 'admin2', action_type: 'complete_payment', target_type: 'payment', target_id: 'p6', details: { reference: 'BZ-PY-2026-1199' }, created_at: ago(0.7) },
  { id: 'al3', admin_user_id: 'admin1', action_type: 'add_exchange_rate', target_type: 'rate', target_id: 'r1', details: { description: '1 M XAF = ¥ 11 530' }, created_at: ago(3) },
  { id: 'al4', admin_user_id: 'admin3', action_type: 'update_client', target_type: 'client', target_id: 'u3', details: { client_name: 'Jean-Paul Mbarga' }, created_at: ago(22) },
  { id: 'al5', admin_user_id: 'admin2', action_type: 'reject_payment', target_type: 'payment', target_id: 'p7', details: { reference: 'BZ-PY-2026-1188' }, created_at: ago(25) },
  { id: 'al6', admin_user_id: 'admin1', action_type: 'set_wallet_overdraft', target_type: 'wallet', target_id: 'u6', details: { client_name: 'Ibrahim Touré · 2 M' }, created_at: ago(28) },
];
const opsBatches = [
  { id: 'b1', reference: 'BZ-LT-2610-07', user_id: 'u3', line_count: 3, total_amount_rmb: 66400, total_amount_xaf: 5760000, note: 'Commande d’octobre', created_by: 'admin1', created_at: ago(2), updated_at: ago(1) },
  { id: 'b2', reference: 'BZ-LT-2610-05', user_id: 'u5', line_count: 2, total_amount_rmb: 21300, total_amount_xaf: 1851000, note: null, created_by: 'admin1', created_at: ago(30), updated_at: ago(20) },
];
const opsBatchLines = [
  { ...payments[2], id: 'bl1', batch_id: 'b1', user_id: 'u3', reference: 'BZ-PY-2026-1210', amount_rmb: 24000, amount_xaf: 2082000, status: 'completed', beneficiary_name: 'Guangzhou Hengtai Trading', method: 'alipay', created_at: ago(2) },
  { ...payments[1], id: 'bl2', batch_id: 'b1', user_id: 'u3', reference: 'BZ-PY-2026-1211', amount_rmb: 18200, amount_xaf: 1578000, status: 'ready_for_payment', beneficiary_name: 'Yiwu Jinsheng Textile', method: 'wechat', created_at: ago(2) },
  { ...payments[0], id: 'bl3', batch_id: 'b1', user_id: 'u3', reference: 'BZ-PY-2026-1212', amount_rmb: 24200, amount_xaf: 2100000, status: 'ready_for_payment', beneficiary_name: 'Foshan Meida Furniture', method: 'bank_transfer', created_at: ago(2) },
  { ...payments[2], id: 'bl4', batch_id: 'b2', user_id: 'u5', reference: 'BZ-PY-2026-1180', amount_rmb: 12000, amount_xaf: 1043000, status: 'completed', beneficiary_name: 'Chen Xiaoli', method: 'alipay', created_at: ago(30) },
  { ...payments[1], id: 'bl5', batch_id: 'b2', user_id: 'u5', reference: 'BZ-PY-2026-1181', amount_rmb: 9300, amount_xaf: 808000, status: 'completed', beneficiary_name: 'Li Wei', method: 'wechat', created_at: ago(30) },
];
function respondOps(url) {
  if (url.includes('/admin_audit_logs')) return opsAuditLogs;
  // Justificatifs : la preuve avec son dépôt (select=*,deposits(*)).
  if (url.includes('/deposit_proofs') && /deposits(%28|\()/.test(url)) return depositProofs.map((p) => ({ ...p, deposits: deposits.find((d) => d.id === p.deposit_id) ?? null }));
  if (url.includes('/user_roles') && /select=user_id(%2C|,)first_name(%2C|,)last_name/.test(url)) return opsTeam;
  if (url.includes('/payment_batches')) {
    const m = url.match(/[?&]id=eq\.([^&]+)/);
    return m ? opsBatches.filter((b) => b.id === decodeURIComponent(m[1])) : opsBatches;
  }
  if (url.includes('/payments') && url.includes('batch_id=')) {
    const eq = url.match(/batch_id=eq\.([^&]+)/);
    if (eq) return opsBatchLines.filter((l) => l.batch_id === decodeURIComponent(eq[1]));
    return opsBatchLines;
  }
  return undefined;
}

function respond(url) {
  const ops = respondOps(url);
  if (ops !== undefined) return ops;
  // Module Messages · Douane · Mola · Outils (refonte v2) : voir respondOutils, en fin de fichier.
  { const extra = respondOutils(url); if (extra !== undefined) return extra; }
  if (url.includes('/rpc/get_deposit_stats')) return stats;
  if (url.includes('/storage/v1/object/sign')) {
    // Echo the object path so the GET interception can tell QR from proof.
    const m = url.match(/object\/sign\/([^?]+)/);
    return { signedURL: `/object/fake/${m ? m[1] : 'unknown'}?sig=1` };
  }
  if (url.includes('/notifications')) {
    const m = url.match(/user_id=eq\.([^&]+)/);
    const mine = m ? notifications.filter((n) => n.user_id === decodeURIComponent(m[1])) : notifications;
    return url.includes('is_read=eq.false') ? mine.filter((n) => !n.is_read) : mine;
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
  // Module Taux : les écritures répondent « succès » (écran de succès, feuilles qui se ferment).
  if (url.includes('/rpc/create_daily_rates')) return { success: true, rate_id: 'r-new' };
  if (url.includes('/rpc/update_daily_rate') || url.includes('/rpc/delete_daily_rate') || url.includes('/rpc/update_rate_adjustment') || url.includes('/rpc/mark_suggestion_applied')) return { success: true };
  // Analyses (écran Équipe) : le journal des actions de l'équipe.
  if (url.includes('/admin_audit_logs')) return auditLogs;
  const tr = treasuryRespond(url);
  if (tr !== undefined) return tr;
  return [];
}


export { respond, qrSvg, proofSvg };
export function headCount(url) {
  if (url.includes('/notifications')) return url.includes('is_read=eq.false') ? 2 : 4;
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
  if (url.includes('/webauthn_credentials')) return 2; // Moi › Clés d'accès (refonte v2)
  return 0;
}

// Analyses mobile (écran Équipe) — actions de l'équipe sur 30 jours, inventées.
const auditLogs = (() => {
  const team = [['a1', 46, 58, 2], ['a2', 61, 34, 1], ['a3', 30, 21, 0], ['a4', 0, 28, 0], ['a5', 9, 0, 1]];
  const out = [];
  let k = 0;
  for (const [id, dep, pay, rej] of team) {
    for (let i = 0; i < dep; i++) out.push({ admin_user_id: id, action_type: 'validate_deposit', created_at: ago((k++ * 7.3) % 700) });
    for (let i = 0; i < pay; i++) out.push({ admin_user_id: id, action_type: 'process_payment', created_at: ago((k++ * 5.1) % 700) });
    for (let i = 0; i < rej; i++) out.push({ admin_user_id: id, action_type: 'reject_deposit', created_at: ago((k++ * 3.7) % 700) });
  }
  return out;
})();
// ── Trésorerie (refonte mobile v2) ─────────────────────────────────────────
// Les hooks de la trésorerie sont substitués par src/__screenshot__/mockTreasury.ts.
// Restent les lectures directes de l'écran mobile : le bénéfice semaine par
// semaine (get_treasury_dashboard, une fois par semaine) et le nom de qui a
// annulé. Le corps d'une RPC n'arrive pas jusqu'ici : les appels d'une même
// page reçoivent chacun leur bénéfice, dans l'ordre.
const trWeekly = [212400, 248900, 190300, 305100, 242700, 312000, 340000, 155000];
let trDashN = 0;
let trDashT = 0;
function treasuryRespond(url) {
  if (url.includes('/rpc/get_treasury_dashboard')) {
    const t = Date.now();
    if (t - trDashT > 1500) trDashN = 0;
    trDashT = t;
    const benefit = trWeekly[trDashN++ % trWeekly.length];
    return {
      success: true, period: { from: ago(168), to: ago(0) }, balances: [], totals_by_currency: {},
      purchases: { count: 2, total_xaf: 2_540_000, total_usdt: 4_000, weighted_avg_rate_xaf_per_usdt: 635 },
      sales: { count: 1, total_usdt: 1_800, total_cny: 12_996, weighted_avg_rate_cny_per_usdt: 7.22 },
      client_rate: { count: 9, total_xaf: 2_100_000, total_cny: 22_800, weighted_avg_rate_xaf_per_cny: 92.1 },
      wac_usdt_current: 638.42, stock_usdt: 8_420.5, is_stock_usdt_negative: false, spread_chain_xaf: 0, spread_client_xaf: 0,
      benefit_total_xaf: benefit, capital_immobilized_current_xaf: 11_620_000, taux_de_revient_xaf_per_cny: 88.24,
    };
  }
  return undefined;
}

// ─── Module Messages clients · Douane · Mola · Outils (refonte v2) ─────────
// Tables propres au module, et ce que les tables partagées doivent porter
// pour lui (les clients avec leur `id` et leur code, les admins du support).
const outilsClients = clients.map((c, i) => ({ ...c, id: `c${i + 1}`, customer_code: ['BZ-3107', 'BZ-2290', 'BZ-1874', 'BZ-5107', 'BZ-4821', 'BZ-6033', 'BZ-7712'][i] }));
const supportAdmins = [
  { id: 'ur1', user_id: 'screenshot-admin', first_name: 'Nelson', last_name: 'Kamdem', role: 'super_admin', is_disabled: false },
  { id: 'ur2', user_id: 'adm-2', first_name: 'Christelle', last_name: 'Fotso', role: 'support', is_disabled: false },
  { id: 'ur3', user_id: 'adm-3', first_name: 'Mireille', last_name: 'Ekambi', role: 'customer_success', is_disabled: false },
];
const minutesAgo = (m) => new Date(now - m * 60_000).toISOString();
const today = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const chatConversations = [
  { id: 'cv1', client_id: 'c5', subject: 'Paiement Hengtai', assigned_admin_id: 'ur1', status: 'open', last_message_at: today(9, 24), last_client_message_at: today(9, 24), last_admin_message_at: today(9, 20), unread_count_client: 0, unread_count_admin: 2, created_at: today(9, 12), updated_at: today(9, 24) },
  { id: 'cv2', client_id: 'c6', subject: null, assigned_admin_id: null, status: 'open', last_message_at: today(8, 51), last_client_message_at: today(8, 51), last_admin_message_at: null, unread_count_client: 0, unread_count_admin: 1, created_at: today(8, 51), updated_at: today(8, 51) },
  { id: 'cv3', client_id: 'c4', subject: 'Colis Douala', assigned_admin_id: null, status: 'open', last_message_at: today(8, 30), last_client_message_at: today(8, 30), last_admin_message_at: null, unread_count_client: 0, unread_count_admin: 3, created_at: today(8, 10), updated_at: today(8, 30) },
  { id: 'cv4', client_id: 'c3', subject: null, assigned_admin_id: 'ur2', status: 'open', last_message_at: ago(20), last_client_message_at: ago(21), last_admin_message_at: ago(20), unread_count_client: 0, unread_count_admin: 0, created_at: ago(30), updated_at: ago(20) },
  { id: 'cv5', client_id: 'c7', subject: null, assigned_admin_id: 'ur1', status: 'open', last_message_at: ago(22), last_client_message_at: ago(23), last_admin_message_at: ago(22), unread_count_client: 0, unread_count_admin: 0, created_at: ago(26), updated_at: ago(22) },
  { id: 'cv6', client_id: 'c1', subject: null, assigned_admin_id: 'ur2', status: 'closed', last_message_at: ago(70), last_client_message_at: ago(71), last_admin_message_at: ago(70), unread_count_client: 0, unread_count_admin: 0, created_at: ago(80), updated_at: ago(70) },
];
const msg = (id, conv, who, content, at, extra = {}) => ({ id, conversation_id: conv, sender_type: who, sender_id: who === 'admin' ? 'screenshot-admin' : 'client', content, media_url: null, media_type: null, media_duration_seconds: null, media_size_bytes: null, media_filename: null, media_waveform_peaks: null, reply_to_message_id: null, read_at: who === 'admin' ? at : null, created_at: at, ...extra });
const chatMessages = [
  msg('m1', 'cv1', 'client', "J'ai déposé 500 000 ce matin par Orange Money", today(9, 12)),
  msg('m2', 'cv1', 'client', null, today(9, 13), { media_url: 'chat-media/cv1/recu-om.png', media_type: 'image' }),
  msg('m3', 'cv1', 'admin', 'Merci Fatou, je vérifie et je crédite votre compte.', today(9, 20)),
  msg('m4', 'cv1', 'client', "Le paiement à Hengtai peut partir aujourd'hui ?", today(9, 24)),
  msg('m5', 'cv2', 'client', null, today(8, 51), { media_url: 'chat-media/cv2/photo.jpg', media_type: 'image' }),
  msg('m6', 'cv3', 'client', 'Mon colis est arrivé à Douala ?', today(8, 30)),
  msg('m7', 'cv4', 'admin', "C'est noté, merci.", ago(20)),
  msg('m8', 'cv5', 'admin', 'Le taux du jour est ¥ 10 838', ago(22)),
  msg('m9', 'cv6', 'admin', 'Votre fournisseur a reçu le paiement.', ago(70)),
];
const cannedResponses = [
  { id: 'cr1', label: 'Dépôt reçu', content: 'Bonjour {{client_first_name}}, votre dépôt est bien reçu. Nous le vérifions et vous prévenons dès qu’il est crédité.', variables: [], sort_order: 1, created_by: null, created_at: ago(400), updated_at: ago(400) },
  { id: 'cr2', label: 'Dépôt crédité', content: '{{client_first_name}}, votre compte est crédité de votre dépôt. Vous pouvez payer votre fournisseur.', variables: [], sort_order: 2, created_by: null, created_at: ago(400), updated_at: ago(400) },
  { id: 'cr3', label: 'Paiement envoyé', content: 'Votre fournisseur a reçu ¥… Preuve jointe.', variables: [], sort_order: 3, created_by: null, created_at: ago(400), updated_at: ago(400) },
  { id: 'cr4', label: 'Taux du jour', content: "1 000 000 XAF = ¥ 10 838 aujourd'hui.", variables: [], sort_order: 4, created_by: null, created_at: ago(400), updated_at: ago(400) },
  { id: 'cr5', label: 'Info fournisseur', content: 'Envoyez-nous le QR Alipay ou WeChat de votre fournisseur, avec son nom.', variables: [], sort_order: 5, created_by: null, created_at: ago(400), updated_at: ago(400) },
];
const quickReplies = [
  { id: 'qr1', label: 'Comment ça marche ?', content: "Pouvez-vous m'expliquer comment fonctionne le paiement de mes fournisseurs ?", sort_order: 1, active: true, created_at: ago(400), updated_at: ago(400) },
  { id: 'qr2', label: 'Mon paiement est en retard', content: 'Mon paiement semble en retard, pouvez-vous vérifier ?', sort_order: 2, active: true, created_at: ago(400), updated_at: ago(400) },
  { id: 'qr3', label: 'Question sur les taux', content: "J'ai une question sur les taux de change.", sort_order: 3, active: true, created_at: ago(400), updated_at: ago(400) },
  { id: 'qr4', label: 'Autre question', content: "Bonjour, j'ai une question :", sort_order: 4, active: false, created_at: ago(400), updated_at: ago(400) },
];
const dayIso = (back) => { const d = new Date(now - back * 86400_000); return d.toISOString().slice(0, 10); };
const chatStats = (days) => ({
  period_days: days, open_conversations: 14, closed_conversations: 61, unassigned_open: 2, total_messages: 1286, client_messages: 702, admin_messages: 584,
  avg_response_seconds_global: 372, median_response_seconds_global: 184,
  per_admin: [
    { admin_user_id: 'adm-3', first_name: 'Mireille', last_name: 'Ekambi', replies_count: 412, avg_response_seconds: 130 },
    { admin_user_id: 'screenshot-admin', first_name: 'Nelson', last_name: 'Kamdem', replies_count: 108, avg_response_seconds: 420 },
    { admin_user_id: 'adm-2', first_name: 'Christelle', last_name: 'Fotso', replies_count: 64, avg_response_seconds: 610 },
  ],
  daily_volume: Array.from({ length: days }, (_, i) => {
    const k = (i * 37) % 11;
    return { day: dayIso(days - 1 - i), client_count: 48 + k * 9, admin_count: 30 + ((k * 5) % 7) * 6 };
  }),
  response_buckets: { under_1min: 120, one_to_five: 260, five_to_fifteen: 140, over_fifteen: 64 },
});

const cCard = (c) => ({ user_id: c.user_id, first_name: c.first_name, last_name: c.last_name, company_name: null, customer_code: outilsClients.find((x) => x.user_id === c.user_id)?.customer_code ?? null });
const cAicha = cCard(clients[3]);
const cRosine = { user_id: 'u8', first_name: 'Rosine', last_name: 'Tchoua', company_name: null, customer_code: 'BZ-2604' };
const cSamuel = { user_id: 'u9', first_name: 'Samuel', last_name: 'Nkoulou', company_name: null, customer_code: 'BZ-3318' };
const customsQueue = {
  success: true, is_broker: true,
  classifications: [
    { id: 'cl1', ref: 'CL-0412', product_name: 'Chaussures de sport', proposed_code: '640411', status: 'in_review', submitted_at: ago(2), claimed_by: 'screenshot-admin', mine: true, client: cAicha },
    { id: 'cl2', ref: 'CL-0415', product_name: 'Tissu wax 100 % coton', proposed_code: '520852', status: 'submitted', submitted_at: ago(5), claimed_by: null, mine: false, client: cRosine },
    { id: 'cl3', ref: 'CL-0418', product_name: 'Chaises de salon', proposed_code: '940161', status: 'submitted', submitted_at: ago(26), claimed_by: null, mine: false, client: cSamuel },
  ],
  audits: [
    { id: 'au1', ref: 'AU-0087', dau_number: '118452', overpaid_xaf: 1284000, claim_deadline: null, status: 'in_review', submitted_at: ago(9), claimed_by: 'screenshot-admin', mine: true, client: cSamuel },
    { id: 'au2', ref: 'AU-0091', dau_number: '119007', overpaid_xaf: 420000, claim_deadline: null, status: 'submitted', submitted_at: ago(30), claimed_by: null, mine: false, client: cCard(clients[2]) },
  ],
  recent: [
    { kind: 'classification', id: 'cl0', ref: 'CL-0398', label: 'Panneaux solaires', status: 'approved', final_code: '854143', amount_xaf: null, reviewed_at: ago(30) },
    { kind: 'audit', id: 'au0', ref: 'AU-0080', label: 'DAU 117320', status: 'approved', final_code: null, amount_xaf: 650000, reviewed_at: ago(50) },
  ],
};
const customsClassification = {
  id: 'cl1', ref: 'CL-0412', client_user_id: 'u4', product_name: 'Chaussures de sport homme', description: null,
  facts: {}, photo_paths: ['u4/cl1/1.jpg', 'u4/cl1/2.jpg', 'u4/cl1/3.jpg', 'u4/cl1/4.jpg', 'u4/cl1/5.jpg'], candidates: [],
  proposed_code: '640411', status: 'in_review', submitted_at: ago(2), final_code: null, broker_note: null, claimed_by: 'screenshot-admin',
  reviewed_by: null, reviewed_at: null, broker_company: null, broker_license_no: null, created_at: ago(3), updated_at: ago(2), client: cAicha,
  messages: [
    { id: 'cm1', author: 'client', body: 'Baskets homme, dessus en textile, semelle caoutchouc.', payload: null, created_at: ago(3) },
    { id: 'cm2', author: 'assistant', body: 'Le dessus en textile et la semelle en caoutchouc mènent à la position 6404.', created_at: ago(2.9), payload: { type: 'proposal', candidates: [
      { code: '640411', title: 'Chaussures de sport, dessus textile', heading: 'Chaussures à dessus en matières textiles', rate_min: 30, rate_max: 30, confidence: 0.86, reasoning: 'Dessus textile, semelle caoutchouc, usage sportif.', rules: ['RGI 1', 'RGI 6'] },
      { code: '640419', title: 'Autres chaussures, dessus textile', heading: 'Chaussures à dessus en matières textiles', rate_min: 30, rate_max: 30, confidence: 0.32, reasoning: 'Si l’usage sportif n’est pas établi.', rules: ['RGI 1'] },
    ], missing_facts: ['usage sportif'] } },
  ],
};
const customsAudit = {
  id: 'au1', ref: 'AU-0087', client_user_id: 'u9', dau_number: '118452', customs_office: 'Douala Port', registered_on: '2026-10-04', paid_on: '2026-10-06',
  file_paths: ['u9/au1/dau-118452.pdf', 'u9/au1/facture.pdf', 'u9/au1/bl.pdf'], status: 'in_review', extraction: null, findings: [], total_paid_xaf: 9850000,
  overpaid_xaf: 1284000, recoverable_xaf: null, claim_deadline: null, ai_model: null, error: null, submitted_at: ago(9), broker_note: null,
  claimed_by: 'screenshot-admin', reviewed_by: null, reviewed_at: null, broker_company: null, broker_license_no: null, created_at: ago(30), updated_at: ago(9), client: cSamuel,
};
const iso = (days) => new Date(now - days * 86400_000).toISOString().slice(0, 10);
const notice = (o) => ({ advice: null, status: 'in_force', ends_on: null, delay_days: null, hs_specs: [], places: [], source_label: null, source_url: null, confidence: 'marche', published: true, published_at: ago(48), created_at: ago(48), updated_at: ago(48), ...o });
const customsNotices = [
  notice({ id: 'nt1', slug: 'port-douala-sature', kind: 'disruption', title: 'Port de Douala saturé', summary: 'Attente au mouillage de 3 à 5 jours, quais pleins.', severity: 'high', starts_on: iso(7), delay_days: 4, places: ['CMDLA'], source_label: 'PAD', advice: 'Prévoir la franchise' }),
  notice({ id: 'nt2', slug: 'greve-corridor-tchad', kind: 'disruption', title: 'Grève Douala – N’Djamena', summary: 'Camionneurs en grève sur le corridor.', severity: 'medium', starts_on: iso(3), delay_days: 2, places: ['CM-TD'] }),
  notice({ id: 'nt3', slug: 'escale-lome', kind: 'disruption', title: 'Escale de Lomé allongée', summary: 'Les services passant par Lomé ajoutent un jour.', severity: 'low', starts_on: iso(2), delay_days: 1, places: ['TGLFW'], published: false, published_at: null }),
  notice({ id: 'nt4', slug: 'tec-2026-textiles', kind: 'regulation', title: 'TEC 2026 : textiles à 30 %', summary: 'Le droit sur les tissus de coton passe à 30 %.', severity: 'medium', starts_on: iso(20), hs_specs: ['5208', '6404'], confidence: 'officiel', source_label: 'Loi de finances 2026' }),
  notice({ id: 'nt5', slug: 'controle-chaussures', kind: 'regulation', title: 'Contrôle renforcé · chaussures', summary: 'Contrôle physique systématique à Douala pour le chapitre 64.', severity: 'medium', starts_on: iso(10), hs_specs: ['64'], places: ['CMDLA'], source_label: 'DGD' }),
  notice({ id: 'nt6', slug: 'greve-dockers-ancienne', kind: 'disruption', title: 'Grève des dockers', summary: 'Terminée.', severity: 'medium', starts_on: iso(60), ends_on: iso(55), delay_days: 3, places: ['CMDLA'] }),
];
const observedTransit = { window_months: 18, min_count: 3, lanes: [
  { mode: 'sea', lane: 'CNNSA>CMKBI', n: 23, median: 41, p25: 38, p75: 46, promised_median: 38, late_share: 0.3 },
  { mode: 'sea', lane: 'CNNSA>CMDLA', n: 12, median: 44, p25: 40, p75: 49, promised_median: 39, late_share: 0.4 },
  { mode: 'air', lane: 'CAN>DLA', n: 31, median: 6, p25: 5, p75: 8, promised_median: 5, late_share: 0.2 },
] };

const macroSnapshot = { id: 1, captured_at: minutesAgo(12), oil_brent: 82.4, oil_wti: 78.15, dxy: 104.2, eur_usd: 1.0862, cny_usd: 7.1204, btc_usd: 67420, eth_usd: 3120,
  news_headlines: [{ title: 'Le yuan se stabilise avant la réunion de la PBoC', source: 'Google News (Reuters)', published_at: ago(3), link: 'https://example.com/a' }],
  news_by_source: null, trump_posts_recent: null, expert_mentions: null };
const ratePrediction = { id: 'rp1', created_at: ago(2), current_rate: 7.1204, predicted_rate: 7.118, direction: 'down', confidence: 0.72, key_drivers: ['DXY'], reasoning: 'Le dollar recule légèrement ; la PBoC garde un fixing stable.', scenarios: null, action_recommended: 'Garder le taux', actual_rate: null, error_abs: null };
const passkeys = [
  { id: 'pk1', device_label: 'iPhone de Nelson', backed_up: true, created_at: '2026-09-03T08:00:00Z', last_used_at: ago(1) },
  { id: 'pk2', device_label: 'MacBook Air', backed_up: true, created_at: '2026-08-12T08:00:00Z', last_used_at: ago(50) },
];

function respondOutils(url) {
  const q = decodeURIComponent(url);
  if (q.includes('/rpc/cargo_pricing_get')) return { success: true, air_per_kg_xaf: 8500, sea_per_cbm_xaf: 165000, currency: 'XAF', updated_at: ago(200) };
  if (q.includes('/rest/v1/macro_snapshots')) return [macroSnapshot];
  if (q.includes('/rest/v1/rate_predictions')) return [ratePrediction];
  if (q.includes('/rest/v1/briefs_log')) return [{ id: 'b1', sent_at: ago(5), brief_type: 'morning', message_text: 'Brief du matin : USD/CNY 7,12, Brent 82,4 $.', telegram_sent: true, telegram_error: null }];
  if (q.includes('/rest/v1/trump_posts')) return [];
  if (q.includes('/rest/v1/webauthn_credentials')) return passkeys;
  if (q.includes('/rpc/customs_review_queue')) return customsQueue;
  if (q.includes('/rpc/customs_classification_get')) return { success: true, classification: customsClassification };
  if (q.includes('/rpc/customs_audit_get')) return { success: true, audit: customsAudit };
  if (q.includes('/rpc/logistics_observed_transit')) return observedTransit;
  if (q.includes('/rest/v1/customs_notices')) return customsNotices;
  if (q.includes('/storage/v1/object/sign/customs-documents')) return [...customsAudit.file_paths, 'u4/cl1/4.jpg', 'u4/cl1/5.jpg'].map((path) => ({ path, signedURL: `/object/fake/customs/${path.split('/').pop()}?sig=1`, error: null }));
  if (q.includes('/rpc/get_chat_admin_stats')) { const m = q.match(/"p_period_days":(\d+)/); return chatStats(m ? Number(m[1]) : 7); }
  if (q.includes('/rpc/search_chat_conversations')) return [{ conversation_id: 'cv1', snippet: 'Le paiement à Hengtai peut partir aujourd’hui ?' }];
  if (q.includes('/rpc/mark_conversation_read_admin') || q.includes('/rpc/claim_chat_conversation') || q.includes('/rpc/assign_chat_conversation')) return null;
  if (q.includes('/rest/v1/chat_conversations')) {
    const m = q.match(/[?&]id=eq\.([^&]+)/);
    if (m) return chatConversations.filter((c) => c.id === m[1]);
    const st = q.match(/[?&]status=eq\.([a-z]+)/);
    return st ? chatConversations.filter((c) => c.status === st[1]) : chatConversations;
  }
  if (q.includes('/rest/v1/chat_messages')) {
    const one = q.match(/conversation_id=eq\.([^&]+)/);
    if (one) return chatMessages.filter((m) => m.conversation_id === one[1]);
    return [...chatMessages].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  if (q.includes('/rest/v1/chat_message_reactions')) return [];
  if (q.includes('/rest/v1/chat_canned_responses')) return cannedResponses;
  if (q.includes('/rest/v1/chat_client_quick_replies')) return quickReplies;
  if (q.includes('/rest/v1/user_roles') && q.includes('first_name')) return supportAdmins;
  if (q.includes('/rest/v1/clients') && /[?&]id=(eq|in)\./.test(q)) {
    const one = q.match(/[?&]id=eq\.([^&]+)/);
    if (one) return outilsClients.filter((c) => c.id === one[1]);
    const many = q.match(/[?&]id=in\.\(([^)]*)\)/);
    const ids = many ? many[1].split(',').map((x) => x.replace(/"/g, '')) : [];
    return outilsClients.filter((c) => ids.includes(c.id));
  }
  return undefined;
}

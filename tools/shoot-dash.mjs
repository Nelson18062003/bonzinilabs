// DEV-ONLY: render the admin HOME dashboard (/m) via the harness with mocked
// data. All Supabase calls are intercepted — nothing real is contacted.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });

const iPhone = devices['iPhone 14'];
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE',
};

const stats = {
  totalClients: 128,
  activeClients: 96,
  totalWalletBalance: 48750000,
  pendingDeposits: 3,
  pendingPayments: 2,
  currentRate: 92,
  todayPaymentsAmount: 12400000,
  weekVolume: 86200000,
};
const depositStats = { to_process: 3, today_amount: 8200000, today_count: 4, total: 540 };
const rate = {
  id: 'r1', is_active: true,
  rate_cash: 86500, rate_alipay: 92100, rate_wechat: 91800, rate_virement: 90500,
  effective_at: new Date().toISOString(),
};
// Rates module (M5) — history (newest first) for the history/chart tabs.
const ratesHistory = [
  { id: 'r1', is_active: true, rate_cash: 86500, rate_alipay: 92100, rate_wechat: 91800, rate_virement: 90500, effective_at: new Date().toISOString(), created_at: new Date().toISOString(), created_by: 'a1' },
  { id: 'r2', is_active: false, rate_cash: 86200, rate_alipay: 91800, rate_wechat: 91500, rate_virement: 90200, effective_at: new Date(Date.now() - 864e5).toISOString(), created_at: new Date(Date.now() - 864e5).toISOString(), created_by: 'a1' },
  { id: 'r3', is_active: false, rate_cash: 85900, rate_alipay: 91500, rate_wechat: 91200, rate_virement: 89900, effective_at: new Date(Date.now() - 1728e5).toISOString(), created_at: new Date(Date.now() - 1728e5).toISOString(), created_by: 'a2' },
  { id: 'r4', is_active: false, rate_cash: 86100, rate_alipay: 91700, rate_wechat: 91400, rate_virement: 90100, effective_at: new Date(Date.now() - 2592e5).toISOString(), created_at: new Date(Date.now() - 2592e5).toISOString(), created_by: 'a1' },
  { id: 'r5', is_active: false, rate_cash: 85700, rate_alipay: 91300, rate_wechat: 91000, rate_virement: 89700, effective_at: new Date(Date.now() - 3456e5).toISOString(), created_at: new Date(Date.now() - 3456e5).toISOString(), created_by: 'a3' },
];
// Country (cameroun = REF 0%) + tier adjustments for Config/Simulator tabs.
const rateAdjustments = [
  { id: 'aj1', type: 'country', key: 'cameroun', label: 'Cameroun', percentage: 0, is_reference: true, sort_order: 0, updated_at: new Date().toISOString(), updated_by: null },
  { id: 'aj2', type: 'country', key: 'gabon', label: 'Gabon', percentage: -1.5, is_reference: false, sort_order: 1, updated_at: new Date().toISOString(), updated_by: null },
  { id: 'aj3', type: 'country', key: 'tchad', label: 'Tchad', percentage: -2, is_reference: false, sort_order: 2, updated_at: new Date().toISOString(), updated_by: null },
  { id: 'aj4', type: 'tier', key: 't3', label: '≥ 1 000 000 XAF', percentage: 0, is_reference: true, sort_order: 0, updated_at: new Date().toISOString(), updated_by: null },
  { id: 'aj5', type: 'tier', key: 't2', label: '400 000 – 999 999 XAF', percentage: -1, is_reference: false, sort_order: 1, updated_at: new Date().toISOString(), updated_by: null },
  { id: 'aj6', type: 'tier', key: 't1', label: '10 000 – 399 999 XAF', percentage: -2.5, is_reference: false, sort_order: 2, updated_at: new Date().toISOString(), updated_by: null },
];
const deposits = [
  { id: 'd1', reference: 'BZ-DP-001', method: 'bank_transfer', bank_name: 'Afriland First Bank', agency_name: null, admin_comment: null, confirmed_amount_xaf: null, validated_at: null, user_id: 'u1', amount_xaf: 2500000, status: 'proof_submitted', proof_count: 1, created_at: new Date(Date.now() - 36e5).toISOString(), profiles: { first_name: 'Awa', last_name: 'Diop', phone: '+237 6 91 23 45 67', company_name: 'Jako Cargo SARL' } },
  { id: 'd2', reference: 'BZ-DP-002', method: 'om_transfer', bank_name: null, agency_name: null, admin_comment: null, confirmed_amount_xaf: 1800000, validated_at: new Date(Date.now() - 7e6).toISOString(), user_id: 'u2', amount_xaf: 1800000, status: 'validated', proof_count: 2, created_at: new Date(Date.now() - 8e6).toISOString(), profiles: { first_name: 'Jean', last_name: 'Kamga', phone: '+237 6 55 11 22 33', company_name: 'Kamga Import' } },
  { id: 'd3', reference: 'BZ-DP-003', method: 'wave', bank_name: null, agency_name: null, admin_comment: null, confirmed_amount_xaf: null, validated_at: new Date(Date.now() - 1.4e7).toISOString(), user_id: 'u3', amount_xaf: 950000, status: 'validated', proof_count: 0, created_at: new Date(Date.now() - 1.5e7).toISOString(), profiles: { first_name: 'Marie', last_name: 'Nkolo', phone: '+237 6 77 88 99 00', company_name: null } },
  { id: 'd4', reference: 'BZ-DP-004', method: 'agency_cash', bank_name: null, agency_name: 'Agence Douala Akwa', admin_comment: 'Montant non conforme', confirmed_amount_xaf: null, validated_at: null, user_id: 'u4', amount_xaf: 4200000, status: 'rejected', proof_count: 1, created_at: new Date(Date.now() - 9e7).toISOString(), profiles: { first_name: 'Paul', last_name: 'Mballa', phone: '+237 6 33 44 55 66', company_name: 'Mballa Trading' } },
];

// More module (M1) fixtures — history (audit logs) + proofs.
const auditLogs = [
  { id: 'l1', admin_user_id: 'a1', action_type: 'deposit_validated', target_type: 'deposit', created_at: new Date(Date.now() - 12e5).toISOString() },
  { id: 'l2', admin_user_id: 'a2', action_type: 'payment_processing', target_type: 'payment', created_at: new Date(Date.now() - 36e5).toISOString() },
  { id: 'l3', admin_user_id: 'a1', action_type: 'rate_updated', target_type: 'rate', created_at: new Date(Date.now() - 9e6).toISOString() },
  { id: 'l4', admin_user_id: 'a3', action_type: 'client_created', target_type: 'client', created_at: new Date(Date.now() - 9e7).toISOString() },
];
// Superset used both by the audit-log join (reads first/last name) and the
// Admins module (M6) list/detail (reads email, role, is_disabled, created_at).
const adminRoles = [
  { user_id: 'a1', first_name: 'Awa', last_name: 'Diop', email: 'awa@bonzini.com', role: 'super_admin', is_disabled: false, created_at: new Date(Date.now() - 12e9).toISOString() },
  { user_id: 'a2', first_name: 'Jean', last_name: 'Kamga', email: 'jean@bonzini.com', role: 'ops', is_disabled: false, created_at: new Date(Date.now() - 6e9).toISOString() },
  { user_id: 'a3', first_name: 'Marie', last_name: 'Nkolo', email: 'marie@bonzini.com', role: 'cash_agent', is_disabled: true, created_at: new Date(Date.now() - 2e9).toISOString() },
];
const proofs = [
  { id: 'pr1', file_name: 'recu_alipay.jpg', file_url: 'u1/recu_alipay.jpg', uploaded_at: new Date(Date.now() - 12e5).toISOString(), deposits: { id: 'd1', user_id: 'u1' } },
  { id: 'pr2', file_name: 'virement.pdf', file_url: 'u2/virement.pdf', uploaded_at: new Date(Date.now() - 8e6).toISOString(), deposits: { id: 'd2', user_id: 'u2' } },
  { id: 'pr3', file_name: 'preuve_wechat.png', file_url: 'u3/preuve_wechat.png', uploaded_at: new Date(Date.now() - 2e7).toISOString(), deposits: { id: 'd3', user_id: 'u3' } },
];
const proofClients = [
  { user_id: 'u1', first_name: 'Awa', last_name: 'Diop' },
  { user_id: 'u2', first_name: 'Jean', last_name: 'Kamga' },
  { user_id: 'u3', first_name: 'Marie', last_name: 'Nkolo' },
];

// Clients module (M2) fixtures — list + single client + wallet + ledger + carnet.
const clientsList = [
  { user_id: 'u1', first_name: 'Awa', last_name: 'Diop', phone: '+237 6 91 23 45 67', email: 'awa@jakocargo.cm', company_name: 'Jako Cargo SARL', country: 'Cameroun', city: 'Douala', status: 'ACTIVE', created_at: new Date(Date.now() - 9e9).toISOString(), updated_at: new Date().toISOString(), utm_source: 'whatsapp', utm_campaign: 'promo-juin' },
  { user_id: 'u2', first_name: 'Jean', last_name: 'Kamga', phone: '+237 6 55 11 22 33', email: 'jean@import.cm', company_name: 'Kamga Import', country: 'Cameroun', city: 'Yaoundé', status: 'PENDING_KYC', created_at: new Date(Date.now() - 5e9).toISOString(), updated_at: new Date().toISOString() },
  { user_id: 'u3', first_name: 'Marie', last_name: 'Nkolo', phone: '+237 6 77 88 99 00', email: '', company_name: '', country: 'Cameroun', city: 'Bafoussam', status: 'SUSPENDED', created_at: new Date(Date.now() - 2e9).toISOString(), updated_at: new Date().toISOString() },
];
const wallets = [
  { id: 'w1', user_id: 'u1', balance_xaf: 4250000 },
  { id: 'w2', user_id: 'u2', balance_xaf: 0 },
  { id: 'w3', user_id: 'u3', balance_xaf: 120000 },
];
const clientDeposits = [
  { user_id: 'u1', amount_xaf: 6500000, status: 'validated' },
  { user_id: 'u1', amount_xaf: 1800000, status: 'validated' },
];
const clientPayments = [
  { user_id: 'u1', amount_xaf: 4050000, status: 'completed' },
];
const ledgerEntries = [
  { id: 'le1', wallet_id: 'w1', user_id: 'u1', entry_type: 'ADMIN_CREDIT', amount_xaf: 500000, balance_before: 3750000, balance_after: 4250000, reference_type: null, reference_id: null, description: 'Ajustement manuel — régularisation', created_at: new Date(Date.now() - 12e5).toISOString(), created_by_admin_id: 'a1' },
  { id: 'le2', wallet_id: 'w1', user_id: 'u1', entry_type: 'PAYMENT_RESERVED', amount_xaf: 1200000, balance_before: 4950000, balance_after: 3750000, reference_type: 'payment', reference_id: 'p1', description: 'Paiement fournisseur Alipay', created_at: new Date(Date.now() - 8e6).toISOString(), created_by_admin_id: null },
  { id: 'le3', wallet_id: 'w1', user_id: 'u1', entry_type: 'DEPOSIT_VALIDATED', amount_xaf: 1800000, balance_before: 3150000, balance_after: 4950000, reference_type: 'deposit', reference_id: 'd2', description: 'Dépôt validé — virement', created_at: new Date(Date.now() - 2e7).toISOString(), created_by_admin_id: null },
];
const beneficiaries = [
  { id: 'b1', client_id: 'u1', payment_method: 'alipay', alias: 'Fournisseur Shenzhen', name: 'Li Wei', identifier: 'liwei@alipay.cn', identifier_type: 'email', phone: '+86 138 0000 1111', email: null, bank_name: null, bank_account: null, bank_extra: null, relation_type: 'supplier', notes: null, qr_code_url: null, is_archived: false, created_at: new Date().toISOString() },
  { id: 'b2', client_id: 'u1', payment_method: 'wechat', alias: 'Atelier textile', name: 'Zhang Min', identifier: 'zhangmin_wx', identifier_type: 'id', phone: null, email: null, bank_name: null, bank_account: null, bank_extra: null, relation_type: 'supplier', notes: null, qr_code_url: null, is_archived: false, created_at: new Date().toISOString() },
  { id: 'b3', client_id: 'u1', payment_method: 'bank_transfer', alias: 'Usine Guangzhou', name: 'Guangzhou Trading Co', identifier: null, identifier_type: 'id', phone: null, email: null, bank_name: 'ICBC', bank_account: '6222 0000 1234 5678', bank_extra: 'SWIFT ICBKCNBJ', relation_type: 'supplier', notes: null, qr_code_url: null, is_archived: false, created_at: new Date().toISOString() },
];

// This Supabase client version slices maybeSingle()/single() client-side (Accept
// stays application/json), so we discriminate by URL instead: a query filtered to
// one user (user_id=eq.…) is the detail/ledger fetch; an unfiltered query is a list.
function respond(url) {
  const single = url.includes('user_id=eq.'); // one specific client
  if (url.includes('/rpc/get_dashboard_stats')) return stats;
  if (url.includes('/rpc/get_deposit_stats')) return depositStats;
  // Active rate (is_active=true → maybeSingle → object) vs history/chart (order → array).
  if (url.includes('/daily_rates')) {
    return url.includes('is_active=eq.true') ? rate : ratesHistory;
  }
  if (url.includes('/rate_adjustments')) return rateAdjustments;
  if (url.includes('/admin_audit_logs')) return auditLogs;
  if (url.includes('/user_roles')) return adminRoles;
  // Proofs: the count query (?select=deposit_id) and the More screen want the
  // list; the detail screen (deposit_id=eq.…) signs each file_url — return [] so
  // it renders the clean "missing proof" state without hitting storage signing.
  if (url.includes('/deposit_proofs')) return url.includes('deposit_id=eq.') ? [] : proofs;
  if (url.includes('/beneficiaries')) return beneficiaries;
  if (url.includes('/wallets')) return single ? wallets[0] : wallets;
  if (url.includes('/ledger_entries')) return ledgerEntries;
  // Deposit detail fetches one row by id (id=eq.…) and slices single() client-side.
  if (url.includes('/deposits')) {
    if (url.includes('id=eq.')) return deposits[0]; // detail → single deposit
    return single ? clientDeposits : deposits;
  }
  if (url.includes('/clients')) {
    if (single) return clientsList[0]; // detail (maybeSingle slices client-side)
    // proofs screen joins clients by user_id; clients list needs the full rows.
    return url.includes('select=user_id') ? proofClients : clientsList;
  }
  if (url.includes('/payments')) return single ? clientPayments : [];
  return [];
}

const SCREENS = process.env.ONLY ? process.env.ONLY.split(',') : ['dashboard-home'];
const FONT = process.env.FONT || 'dm';
const VIEWPORTS = {
  iphone: { ...iPhone },
  sm: { viewport: { width: 360, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: iPhone.userAgent },
};
const SIZES = process.env.SIZES ? process.env.SIZES.split(',') : ['iphone'];
const SUFFIX = process.env.SUFFIX || ''; // e.g. "-before"

const browser = await chromium.launch();
for (const size of SIZES) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ ...VIEWPORTS[size], colorScheme: theme, locale: 'fr-FR' });
    const page = await ctx.newPage();
    await page.route('**/*supabase.co/**', (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(respond(req.url())) });
    });
    const tag = `${size === 'iphone' ? '' : `-${size}`}${FONT === 'dm' ? '-dm' : ''}`;
    for (const screen of SCREENS) {
      try {
        await page.goto(`http://localhost:8080/screenshot.html?screen=${screen}&theme=${theme}&font=${FONT}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1400);
        await page.screenshot({ path: `shots/${screen}${tag}${SUFFIX}-${theme}.png`, fullPage: true });
        console.log(`OK  ${screen}${tag}${SUFFIX}-${theme}`);
      } catch (e) {
        console.log(`ERR ${screen}${tag}${SUFFIX}-${theme}: ${e.message}`);
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log('done');

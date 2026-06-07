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
const deposits = [
  { id: 'd1', user_id: 'u1', amount_xaf: 2500000, status: 'pending_review', created_at: new Date(Date.now() - 36e5).toISOString(), profiles: { first_name: 'Awa', last_name: 'Diop' } },
  { id: 'd2', user_id: 'u2', amount_xaf: 1800000, status: 'validated', created_at: new Date(Date.now() - 8e6).toISOString(), profiles: { first_name: 'Jean', last_name: 'Kamga' } },
  { id: 'd3', user_id: 'u3', amount_xaf: 950000, status: 'validated', created_at: new Date(Date.now() - 1.5e7).toISOString(), profiles: { first_name: 'Marie', last_name: 'Nkolo' } },
  { id: 'd4', user_id: 'u4', amount_xaf: 4200000, status: 'rejected', created_at: new Date(Date.now() - 9e7).toISOString(), profiles: { first_name: 'Paul', last_name: 'Mballa' } },
];

// More module (M1) fixtures — history (audit logs) + proofs.
const auditLogs = [
  { id: 'l1', admin_user_id: 'a1', action_type: 'deposit_validated', target_type: 'deposit', created_at: new Date(Date.now() - 12e5).toISOString() },
  { id: 'l2', admin_user_id: 'a2', action_type: 'payment_processing', target_type: 'payment', created_at: new Date(Date.now() - 36e5).toISOString() },
  { id: 'l3', admin_user_id: 'a1', action_type: 'rate_updated', target_type: 'rate', created_at: new Date(Date.now() - 9e6).toISOString() },
  { id: 'l4', admin_user_id: 'a3', action_type: 'client_created', target_type: 'client', created_at: new Date(Date.now() - 9e7).toISOString() },
];
const adminRoles = [
  { user_id: 'a1', first_name: 'Awa', last_name: 'Diop' },
  { user_id: 'a2', first_name: 'Jean', last_name: 'Kamga' },
  { user_id: 'a3', first_name: 'Marie', last_name: 'Nkolo' },
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
  if (url.includes('/daily_rates')) return rate; // maybeSingle → object
  if (url.includes('/admin_audit_logs')) return auditLogs;
  if (url.includes('/user_roles')) return adminRoles;
  if (url.includes('/deposit_proofs')) return proofs;
  if (url.includes('/beneficiaries')) return beneficiaries;
  if (url.includes('/wallets')) return single ? wallets[0] : wallets;
  if (url.includes('/ledger_entries')) return ledgerEntries;
  if (url.includes('/deposits')) return single ? clientDeposits : deposits;
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

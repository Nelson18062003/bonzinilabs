// DEV-ONLY: render each Treasury screen via the harness (/screenshot.html) and
// capture light+dark screenshots at iPhone size. All Supabase calls are
// intercepted and answered with fixtures — nothing real is contacted.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('shots', { recursive: true });

const iPhone = devices['iPhone 14'];
const BASE = 'http://localhost:8080/screenshot.html';
const SCREENS = process.env.ONLY
  ? process.env.ONLY.split(',')
  : ['home', 'dashboard', 'new-purchase', 'new-sale', 'purchases', 'sales', 'operations', 'accounts', 'inventory', 'counterparties'];
const THEMES = ['light', 'dark'];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE',
};

const suppliers = [
  { id: 's1', display_name: 'Wang Crypto OTC', short_id: 'F-001', type: 'usdt_supplier', phone: '+8613800000001', wechat_id: 'wang_otc', is_active: true },
  { id: 's2', display_name: 'Li Exchange', short_id: 'F-002', type: 'usdt_supplier', phone: null, wechat_id: 'li_usdt', is_active: true },
];
const buyers = [
  { id: 'b1', display_name: 'Chen Trading Co.', short_id: 'A-001', type: 'cny_buyer', phone: '+8613900000002', wechat_id: 'chen_pay', is_active: true },
];
const counterparties = [...suppliers, ...buyers];

const balances = [
  { id: 'a1', label: 'UBA XAF principal', currency: 'XAF', kind: 'bank', balance: 42500000, sort_order: 1, last_entry_at: '2026-06-03T10:00:00Z' },
  { id: 'a2', label: 'Orange Money', currency: 'XAF', kind: 'mobile_money', balance: 1850000, sort_order: 2, last_entry_at: '2026-06-04T08:00:00Z' },
  { id: 'a3', label: 'Pool USDT (Binance)', currency: 'USDT', kind: 'crypto_pool', balance: 12450.75, sort_order: 3, last_entry_at: '2026-06-04T09:00:00Z' },
  { id: 'a4', label: 'Cash Guangzhou', currency: 'CNY', kind: 'cash', balance: 88000, sort_order: 4, last_entry_at: '2026-06-02T14:00:00Z' },
  { id: 'a5', label: 'Alipay papa', currency: 'CNY', kind: 'alipay', balance: 23450, sort_order: 5, last_entry_at: '2026-06-04T11:00:00Z' },
];
const accounts = balances.map((b) => ({ id: b.id, label: b.label, currency: b.currency, kind: b.kind, code: b.id.toUpperCase(), is_active: true, sort_order: b.sort_order }));

const purchases = [
  { id: 'p1', occurred_at: '2026-06-04T09:12:00Z', xaf_amount: 15000000, usdt_amount: 24783.1471, implicit_rate: 605.2456, voided_at: null, channel: 'bank_transfer', supplier_id: 's1', supplier: suppliers[0], xaf_account: { id: 'a1', code: 'A1', label: 'UBA XAF principal' }, external_ref: 'BIN-8842', notes: null },
  { id: 'p2', occurred_at: '2026-06-02T16:40:00Z', xaf_amount: 6050000, usdt_amount: 10000, implicit_rate: 605.0, voided_at: null, channel: 'mobile_money', supplier_id: 's2', supplier: suppliers[1], xaf_account: { id: 'a2', code: 'A2', label: 'Orange Money' }, external_ref: null, notes: 'paiement échelonné' },
  { id: 'p3', occurred_at: '2026-05-28T11:05:00Z', xaf_amount: 3025000, usdt_amount: 5000, implicit_rate: 605.0, voided_at: '2026-05-29T10:00:00Z', channel: 'cash', supplier_id: 's1', supplier: suppliers[0], xaf_account: { id: 'a1', code: 'A1', label: 'UBA XAF principal' }, external_ref: null, notes: null },
];
const sales = [
  { id: 'sa1', occurred_at: '2026-06-04T13:20:00Z', usdt_amount: 8000, cny_amount: 57040, implicit_rate: 7.13, voided_at: null, wac_at_sale: 605.12, buyer_id: 'b1', buyer: buyers[0], cny_account: { id: 'a4', code: 'A4', label: 'Cash Guangzhou', kind: 'cash' }, external_ref: null, notes: null },
  { id: 'sa2', occurred_at: '2026-06-03T10:00:00Z', usdt_amount: 3000, cny_amount: 21390, implicit_rate: 7.13, voided_at: null, wac_at_sale: 604.8, buyer_id: 'b1', buyer: buyers[0], cny_account: null, external_ref: 'HASH-22', notes: null },
];

const dashboard = {
  success: true,
  period: { from: '2026-06-01', to: '2026-06-04' },
  balances: balances.map((b) => ({ id: b.id, code: b.id.toUpperCase(), label: b.label, currency: b.currency, kind: b.kind, balance: b.balance, is_active: true })),
  totals_by_currency: { XAF: { total: 44350000, account_count: 2 }, USDT: { total: 12450.75, account_count: 1 }, CNY: { total: 111450, account_count: 2 } },
  purchases: { count: 5, total_xaf: 24075000, total_usdt: 39783.15, weighted_avg_rate_xaf_per_usdt: 605.16 },
  sales: { count: 4, total_usdt: 11000, total_cny: 78430, weighted_avg_rate_cny_per_usdt: 7.13 },
  client_rate: { count: 12, total_xaf: 38000000, total_cny: 82000, weighted_avg_rate_xaf_per_cny: 92.68 },
  wac_usdt_current: 605.45,
  stock_usdt: 12450.75,
  is_stock_usdt_negative: false,
  spread_chain_xaf: 1250000,
  spread_client_xaf: 1850000,
  benefit_total_xaf: 3100000,
  capital_immobilized_current_xaf: 7538000000,
  taux_de_revient_xaf_per_cny: 84.9,
};
const topSuppliers = { success: true, type: 'usdt_supplier', overall_weighted_avg_rate: 605.16, top: [
  { id: 's1', display_name: 'Wang Crypto OTC', phone: '+8613800000001', wechat_id: 'wang_otc', operation_count: 8, total_usdt: 24783.15, weighted_avg_rate: 605.24, deviation_pct: 0.18, last_op_at: '2026-06-04T09:12:00Z' },
  { id: 's2', display_name: 'Li Exchange', phone: null, wechat_id: 'li_usdt', operation_count: 3, total_usdt: 15000, weighted_avg_rate: 604.9, deviation_pct: -0.30, last_op_at: '2026-06-02T16:40:00Z' },
] };
const topBuyers = { success: true, type: 'cny_buyer', overall_weighted_avg_rate: 7.13, top: [
  { id: 'b1', display_name: 'Chen Trading Co.', phone: '+8613900000002', wechat_id: 'chen_pay', operation_count: 4, total_usdt: 11000, weighted_avg_rate: 7.13, deviation_pct: 0.0, last_op_at: '2026-06-04T13:20:00Z' },
] };

function respond(url, postData) {
  if (url.includes('/rpc/get_wac_usdt')) return 605.45;
  if (url.includes('/rpc/get_usdt_stock')) return 12450.75;
  if (url.includes('/rpc/get_treasury_dashboard')) return dashboard;
  if (url.includes('/rpc/get_top_counterparties')) return (postData ?? '').includes('cny_buyer') ? topBuyers : topSuppliers;
  if (url.includes('/treasury_account_balances')) return balances;
  if (url.includes('/treasury_accounts')) return accounts;
  if (url.includes('/treasury_counterparties')) return counterparties;
  if (url.includes('/usdt_purchases')) return purchases;
  if (url.includes('/usdt_sales')) return sales;
  if (url.includes('/treasury_ledger_entries')) return [];
  return [];
}

const SIZES = process.env.SIZES ? process.env.SIZES.split(',') : ['iphone'];
const VIEWPORTS = {
  iphone: { ...iPhone },
  sm: { viewport: { width: 360, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: iPhone.userAgent },
};

const browser = await chromium.launch();
for (const size of SIZES) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ ...VIEWPORTS[size], colorScheme: theme });
    const page = await ctx.newPage();
    await page.route('**/*supabase.co/**', (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
      const body = respond(req.url(), req.postData() ?? '');
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    });
    const suffix = size === 'iphone' ? '' : `-${size}`;
    for (const screen of SCREENS) {
      try {
        await page.goto(`${BASE}?screen=${screen}&theme=${theme}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `shots/${screen}${suffix}-${theme}.png`, fullPage: true });
        console.log(`OK  ${screen}${suffix}-${theme}`);
      } catch (e) {
        console.log(`ERR ${screen}${suffix}-${theme}: ${e.message}`);
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log('done');

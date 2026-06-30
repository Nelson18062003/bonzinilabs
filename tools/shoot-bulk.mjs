// DEV-ONLY: capture the REAL BulkPaymentCreate screen via the harness.
// Seeds a client + wallet + carnet via route fixtures, selects the client,
// opens the beneficiary drawer, and screenshots (light + dark). Tall viewport
// so the whole drawer fits in one shot.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('shots', { recursive: true });
const PORT = process.env.PORT || '8080';
const BASE = `http://127.0.0.1:${PORT}/screenshot.html`;

const USER_ID = 'u-bulk-1';
const CLIENTS = [
  { user_id: USER_ID, first_name: 'Yao', last_name: 'Ming', phone: '+237 6 99 00 11 22', company_name: 'Ming Import' },
  { user_id: 'u2', first_name: 'Awa', last_name: 'Diop', phone: '+237 6 70 33 44 55', company_name: 'Diop Trading' },
];
const WALLETS = [
  { user_id: USER_ID, balance_xaf: 5000000 },
  { user_id: 'u2', balance_xaf: 1200000 },
];
const benef = (id, m, alias, name, identifier) => ({
  id, client_id: USER_ID, payment_method: m, alias, name, identifier, identifier_type: 'id',
  phone: null, email: null, bank_name: null, bank_account: null, bank_extra: null,
  qr_code_url: null, relation_type: 'supplier', notes: null, created_by: null,
  created_by_role: 'admin', is_active: true, created_at: '2026-01-01', updated_at: '2026-01-01',
});
const BENEF = [
  benef('b1', 'alipay', 'Textile GZ', 'Guangzhou Textile Co.', 'supplier_gz_8821'),
  benef('b2', 'wechat', 'Shenzhen Elec', 'SZ Electronics Ltd', 'wxid_88s'),
];
const DAILY_RATE = { id: 'r1', is_active: true, rate_cash: 11530, rate_alipay: 11480, rate_wechat: 11350, rate_virement: 11200, effective_at: '2026-06-10', created_at: '2026-06-10' };

function respond(url) {
  if (url.includes('/rest/v1/clients')) return CLIENTS;
  if (url.includes('/rest/v1/wallets')) return WALLETS;
  if (url.includes('/rest/v1/beneficiaries')) return BENEF;
  if (url.includes('/rest/v1/daily_rates')) return [DAILY_RATE];
  if (url.includes('/rest/v1/rate_adjustments')) return [];
  return [];
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE' };

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 1500 }, deviceScaleFactor: 2, colorScheme: theme, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.route('**/*supabase.co/**', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(respond(req.url())) });
  });
  try {
    await page.goto(`${BASE}?screen=bulk-create&theme=${theme}&font=dm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1400);
    await page.locator('button:has-text("Yao")').first().click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `shots/bulk-real-empty-${theme}.png`, fullPage: true });
    console.log(`OK empty-${theme}`);
    await page.locator('button:has-text("Ajouter un bénéficiaire")').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `shots/bulk-real-drawer-${theme}.png` });
    console.log(`OK drawer-${theme}`);
  } catch (e) {
    console.log(`ERR ${theme}: ${e.message}`);
    await page.screenshot({ path: `shots/bulk-real-error-${theme}.png` }).catch(() => {});
  }
  await ctx.close();
}
await browser.close();
console.log('done');

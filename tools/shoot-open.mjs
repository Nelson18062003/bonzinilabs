// DEV-ONLY: open the supplier dropdown on the achat form and screenshot it,
// to show the real (Radix) animated popover vs the old native <select>.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });

const iPhone = devices['iPhone 14'];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };

const suppliers = [
  { id: 's1', display_name: 'Wang Crypto OTC', short_id: 'F-001', type: 'usdt_supplier', phone: null, wechat_id: 'wang_otc', is_active: true },
  { id: 's2', display_name: 'Li Exchange', short_id: 'F-002', type: 'usdt_supplier', phone: null, wechat_id: 'li_usdt', is_active: true },
  { id: 's3', display_name: 'Zhang Pay', short_id: 'F-003', type: 'usdt_supplier', phone: null, wechat_id: 'zhang', is_active: true },
];
const accounts = [
  { id: 'a1', label: 'UBA XAF principal', currency: 'XAF', kind: 'bank', is_active: true, sort_order: 1, code: 'A1' },
  { id: 'a2', label: 'Orange Money', currency: 'XAF', kind: 'mobile_money', is_active: true, sort_order: 2, code: 'A2' },
];
function respond(url) {
  if (url.includes('/rpc/get_wac_usdt')) return 605.45;
  if (url.includes('/treasury_counterparties')) return suppliers;
  if (url.includes('/treasury_accounts')) return accounts;
  return [];
}

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...iPhone, colorScheme: theme });
  const page = await ctx.newPage();
  await page.route('**/*supabase.co/**', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(respond(route.request().url())) });
  });
  await page.goto(`http://localhost:8080/screenshot.html?screen=new-purchase&theme=${theme}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  // Open the first dropdown (Fournisseur).
  await page.getByText('Sélectionner…').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `shots/select-open-${theme}.png`, fullPage: false });
  console.log(`OK select-open-${theme}`);
  await ctx.close();
}
await browser.close();
console.log('done');

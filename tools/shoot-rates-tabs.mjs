// DEV-ONLY: capture chaque onglet du module Taux (clics sur les pilules).
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const iPhone = devices['iPhone 14'];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE' };
// Réutilise les fixtures du shooter principal via import dynamique impossible — on intercepte large :
const ratesActive = { id: 'r1', is_active: true, rate_cash: 11200, rate_alipay: 11530, rate_wechat: 11480, rate_virement: 11350, effective_at: new Date(Date.now() - 6 * 36e5).toISOString() };
const history = Array.from({ length: 5 }, (_, i) => ({ ...ratesActive, id: 'r' + (i + 1), is_active: i === 0, rate_cash: 11200 - i * 30, rate_alipay: 11530 - i * 25, rate_wechat: 11480 - i * 25, rate_virement: 11350 - i * 28, effective_at: new Date(Date.now() - i * 864e5).toISOString(), created_at: new Date(Date.now() - i * 864e5).toISOString() }));
const adjustments = [
  { id: 'a1', adjustment_type: 'country', key: 'cameroun', label: 'Cameroun', percentage: 0, is_reference: true },
  { id: 'a2', adjustment_type: 'country', key: 'gabon', label: 'Gabon', percentage: -1.5, is_reference: false },
  { id: 'a3', adjustment_type: 'country', key: 'tchad', label: 'Tchad', percentage: -2, is_reference: false },
  { id: 'a4', adjustment_type: 'tier', key: 't3', label: '≥ 1M XAF', percentage: 0, is_reference: true },
  { id: 'a5', adjustment_type: 'tier', key: 't2', label: '100k – 1M', percentage: -1, is_reference: false },
  { id: 'a6', adjustment_type: 'tier', key: 't1', label: '< 100k', percentage: -2, is_reference: false },
];
function respond(url) {
  if (url.includes('/daily_rates')) return url.includes('is_active=eq.true') ? ratesActive : history;
  if (url.includes('/rate_adjustments')) return adjustments;
  return [];
}
const TABS = [['today', null], ['simulator', 'Simulateur'], ['history', 'Historique'], ['settings', 'Réglages']];
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...iPhone, colorScheme: theme, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.route('**/*supabase.co/**', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(respond(route.request().url())) });
  });
  await page.goto(`http://localhost:8080/screenshot.html?screen=rates&theme=${theme}&font=dm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  for (const [key, label] of TABS) {
    if (label) {
      try { await page.getByRole('button', { name: label }).first().click(); await page.waitForTimeout(700); }
      catch (e) { console.log('skip ' + key + ': ' + e.message); continue; }
    }
    await page.screenshot({ path: `shots/rates-${key}-${theme}.png`, fullPage: true });
    console.log(`OK rates-${key}-${theme}`);
  }
  await ctx.close();
}
await browser.close();
console.log('done');

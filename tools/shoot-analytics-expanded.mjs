// DEV-ONLY: render the analytics dashboard with EVERY collapsible section
// expanded, so the user can review the whole rebuilt screen at once.
// Requires the dev server running with SCREENSHOT_MOCK=1 (hooks → fixtures).
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });

const iPhone = devices['iPhone 14'];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE' };
const SECTIONS = ['Capital & conversion', 'Clients', 'Opérations', 'Taux', 'Équipe & top clients'];

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ ...iPhone, colorScheme: theme, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.route('**/*supabase.co/**', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '[]' });
  });
  await page.goto('http://localhost:8080/screenshot.html?screen=analytics&theme=' + theme + '&font=dm', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1400);
  for (const name of SECTIONS) {
    try {
      await page.getByRole('button', { name: new RegExp(name, 'i') }).first().click();
      await page.waitForTimeout(250);
    } catch (e) {
      console.log('skip ' + name + ': ' + e.message);
    }
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `shots/analytics-expanded-${theme}.png`, fullPage: true });
  console.log('OK analytics-expanded-' + theme);
  await ctx.close();
}
await browser.close();
console.log('done');

// DEV-ONLY: capture the screens shipped on 18/09 (payment detail, new client,
// client sheet with overdraft) — mobile at iPhone size, desktop at 1440×900.
// All Supabase calls are answered by fixtures; nothing real is contacted.
// Run vite with SCREENSHOT_MOCK=1.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('shots/polish', { recursive: true });
const PORT = process.env.PORT ?? '8090';
const BASE = `http://127.0.0.1:${PORT}/screenshot.html`;
const MOBILE = ['real-rates-m', 'real-pay-detail-m', 'real-pay-done-m', 'real-pay-cash-m', 'real-client-new-m', 'real-client-detail-m', 'real-client-overdrawn-m'];
const DESKTOP = ['real-rates-publish', 'real-flyer-gabon', 'real-client-new', 'real-clients-split', 'real-clients-overdrawn', 'before-dp-split'];
const SCREENS = process.env.ONLY ? process.env.ONLY.split(',') : [...MOBILE, ...DESKTOP];
const THEMES = process.env.THEMES ? process.env.THEMES.split(',') : ['light'];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE,HEAD', 'access-control-expose-headers': 'content-range' };
import { respond, headCount } from './adminFixtures.mjs';

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' });
const iPhone = devices['iPhone 14'];
for (const theme of THEMES) {
  for (const screen of SCREENS) {
    const mobile = MOBILE.includes(screen);
    const ctx = await browser.newContext(mobile ? { ...iPhone, colorScheme: theme } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: theme });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/*supabase.co/**', (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
      const url = req.url();
      if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `0-0/${headCount(url)}` }, body: '' });
      let body = respond(url);
      const accept = req.headers()['accept'] ?? '';
      if (accept.includes('pgrst.object') && Array.isArray(body)) body = body[0] ?? null;
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json', 'content-range': `0-9/${Array.isArray(body) ? body.length : 1}` }, body: JSON.stringify(body) });
    });
    try {
      await page.goto(`${BASE}?screen=${screen}&theme=${theme}&font=dm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `shots/polish/${screen}-${theme}.png`, fullPage: mobile });
      // Sélecteur de pays ouvert, sur le formulaire client.
      if (screen === 'real-client-new-m' || screen === 'real-client-new') {
        const dial = page.locator('button[aria-haspopup="listbox"]').first();
        await dial.click();
        await page.waitForTimeout(600);
        await page.keyboard.type('sierra');
        await page.waitForTimeout(500);
        await page.screenshot({ path: `shots/polish/${screen}-picker-${theme}.png` });
      }
      console.log(`OK  ${screen}-${theme}${errors.length ? `  ⚠ ${errors.length} console error(s): ${errors[0].slice(0, 160)}` : ''}`);
    } catch (e) {
      console.log(`ERR ${screen}-${theme}: ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
}
await browser.close();

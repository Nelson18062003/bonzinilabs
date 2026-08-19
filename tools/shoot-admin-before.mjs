// DEV-ONLY: capture the REAL admin desktop screens (before the redesign) at
// laptop size, with all Supabase REST/RPC/storage calls answered by fixtures —
// nothing real is contacted. Ground truth for docs/admin-redesign.
//
// Run vite with SCREENSHOT_MOCK=1 so the daily-rates hook resolves (topbar chip).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('shots/admin-redesign', { recursive: true });

const BASE = 'http://localhost:8080/screenshot.html';
const SCREENS = process.env.ONLY
  ? process.env.ONLY.split(',')
  : ['before-dd-list', 'before-dd-split', 'before-dd-new', 'before-dp-list', 'before-dp-split', 'before-dp-new'];
const THEMES = process.env.THEMES ? process.env.THEMES.split(',') : ['light'];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE,HEAD',
  'access-control-expose-headers': 'content-range',
};

import { respond, headCount, qrSvg, proofSvg } from './adminFixtures.mjs';

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium',
});
for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  await page.route('**/*supabase.co/**', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
    const url = req.url();
    // Head-count queries (stats, sidebar badges) read the content-range header.
    if (req.method() === 'HEAD') {
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `0-0/${headCount(url)}` }, body: '' });
    }
    // Signed-URL GETs (QR codes, proof images) get a fake SVG by path.
    if (req.method() === 'GET' && url.includes('/storage/v1/object/fake/')) {
      const svg = url.includes('qr') ? qrSvg : proofSvg;
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/svg+xml' }, body: svg });
    }
    let body = respond(url);
    // .single()/.maybeSingle() send Accept: vnd.pgrst.object+json and expect ONE object.
    const accept = req.headers()['accept'] ?? '';
    if (accept.includes('pgrst.object') && Array.isArray(body)) body = body[0] ?? null;
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json', 'content-range': `0-9/${Array.isArray(body) ? body.length : 1}` }, body: JSON.stringify(body) });
  });
  for (const screen of SCREENS) {
    try {
      await page.goto(`${BASE}?screen=${screen}&theme=${theme}&font=dm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `shots/admin-redesign/${screen}-${theme}.png` });
      console.log(`OK  ${screen}-${theme}`);
    } catch (e) {
      console.log(`ERR ${screen}-${theme}: ${e.message}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log('done');

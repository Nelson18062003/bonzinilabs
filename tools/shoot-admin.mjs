// DEV-ONLY: capture the ADMIN DESKTOP REDESIGN mockups (src/__screenshot__/
// adminRedesign) at laptop size, light + dark. The screens are fully static —
// network is still intercepted (empty fixtures) so nothing real is contacted.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('shots/admin-redesign', { recursive: true });

const BASE = 'http://localhost:8080/screenshot.html';
const SCREENS = process.env.ONLY
  ? process.env.ONLY.split(',')
  : ['dd-workbench', 'dd-split', 'dd-validate', 'dd-create', 'dp-workbench', 'dp-split', 'dp-create'];
const THEMES = ['light', 'dark'];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE,HEAD',
  'access-control-expose-headers': 'content-range',
};

// The mockups reuse the REAL DesktopAppShell (sidebar badges, topbar rate),
// so the same fixtures as the before-runner answer its queries.
import { respond, headCount } from './adminFixtures.mjs';

// Remote env pins a different Playwright build than /opt/pw-browsers ships;
// point at the pre-installed Chromium instead of downloading (env guidance).
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium',
});
for (const theme of THEMES) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.route('**/*supabase.co/**', (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
    const url = req.url();
    if (req.method() === 'HEAD') {
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `0-0/${headCount(url)}` }, body: '' });
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
      await page.waitForTimeout(1400);
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

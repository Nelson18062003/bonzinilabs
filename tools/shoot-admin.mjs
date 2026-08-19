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
  'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE',
};

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
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '[]' });
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

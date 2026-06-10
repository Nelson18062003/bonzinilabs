import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const b = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 731, height: 871 }, deviceScaleFactor: 2, locale: 'fr-FR' });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${process.env.PORT || '8083'}/flyer-real-preview.html?theme=${theme}`, { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `shots/flyer-real-${theme}.png` });
  console.log('OK flyer-real-' + theme);
  await ctx.close();
}
await b.close(); console.log('done');

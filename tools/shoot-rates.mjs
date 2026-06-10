// DEV-ONLY: capture the standalone rates maquette (port 8082, dedicated entry).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const PORT = process.env.PORT || '8082';
const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/rates-preview.html?theme=${theme}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `shots/rates-maq-${theme}.png`, fullPage: true });
  console.log('OK rates-maq-' + theme);
  await ctx.close();
}
await browser.close();
console.log('done');

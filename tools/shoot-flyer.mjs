// DEV-ONLY: capture the flyer maquette (width 1000, height auto → fullPage).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: 2, locale: 'fr-FR' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:8080/screenshot.html?screen=flyer&theme=${theme}&font=dm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `shots/flyer-${theme}.png`, fullPage: true });
  console.log('OK flyer-' + theme);
  await ctx.close();
}
await browser.close();
console.log('done');

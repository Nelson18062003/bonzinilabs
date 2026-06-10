// Captures des 3 directions de refonte du module Paiements CLIENT
// (cpay-a/b/c), clair + sombre, iPhone 14 (390px, DPR 3).
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('shots', { recursive: true });
const PORT = process.env.PORT || '8080';
const iPhone = devices['iPhone 14'];

const browser = await chromium.launch();
try {
  for (const key of ['cpay-a', 'cpay-b', 'cpay-c']) {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ ...iPhone, colorScheme: theme, locale: 'fr-FR' });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${PORT}/screenshot.html?screen=${key}&theme=${theme}&font=dm`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `shots/${key}-${theme}.png`, fullPage: true });
      console.log(`✓ ${key}-${theme}.png`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log('done');

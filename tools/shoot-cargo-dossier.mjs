// DEV-ONLY : capture la fiche conteneur (bureau) via le harnais /screenshot.html
// (SCREENSHOT_MOCK=1). Tout appel Supabase restant est intercepté : rien de réel n'est contacté.
//   KEYS=cargo-desk-documents,cargo-desk-apercu node tools/shoot-cargo-dossier.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('shots', { recursive: true });
const PORT = process.env.PORT || '8080';
const KEYS = (process.env.KEYS || 'cargo-desk-documents').split(',');
const THEMES = (process.env.THEMES || 'light').split(',');
const WIDTH = Number(process.env.WIDTH || 1440);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (const key of KEYS) for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 1000 }, colorScheme: theme, locale: 'fr-FR', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }));
  page.on('pageerror', (e) => console.log('pageerror', key, e.message));
  await page.goto(`http://127.0.0.1:${PORT}/screenshot.html?screen=${key}&theme=${theme}&font=dm`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `shots/${key}-${theme}-${WIDTH}.png`, fullPage: true });
  console.log(`OK shots/${key}-${theme}-${WIDTH}.png`);
  await ctx.close();
}
await browser.close();

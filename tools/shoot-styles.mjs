/**
 * Capture les 3 directions visuelles du laboratoire de style.
 * Prérequis : SCREENSHOT_MOCK=1 npx vite --port 8082
 * Usage     : node tools/shoot-styles.mjs [dossier]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? '/tmp/style-shots';
const BASE = 'http://127.0.0.1:8082/treasury-styles.html';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

for (const style of ['a', 'b', 'c']) {
  await page.goto(`${BASE}?style=${style}`, { waitUntil: 'networkidle' });
  // Attendre que les polices Google soient réellement appliquées.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const file = join(OUT, `style-${style}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`✓ ${style} → ${file}`);
}

await browser.close();

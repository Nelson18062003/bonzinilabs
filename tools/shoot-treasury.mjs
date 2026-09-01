/**
 * Capture les vues de la Trésorerie desktop depuis le harnais.
 *
 * Prérequis : SCREENSHOT_MOCK=1 npx vite --port 8081
 * Usage     : node tools/shoot-treasury.mjs [dossier] [--dark]
 *
 * Chromium et Playwright sont préinstallés dans l'environnement
 * (PLAYWRIGHT_BROWSERS_PATH) — ne pas relancer « playwright install ».
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? '/tmp/treasury-shots';
const DARK = process.argv.includes('--dark');
const BASE = 'http://127.0.0.1:8087/treasury-preview.html';

const VIEWS = ['operations', 'analysis', 'accounts', 'inventory', 'counterparties', 'ledger', 'purchase', 'sale'];

mkdirSync(OUT, { recursive: true });

// Le paquet Playwright du projet attend une révision de navigateur différente
// de celle préinstallée dans l'environnement : on pointe explicitement le
// Chromium présent plutôt que d'en télécharger un autre.
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: DARK ? 'dark' : 'light',
});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

for (const view of VIEWS) {
  const url = `${BASE}?view=${view}${DARK ? '&theme=dark' : ''}`;
  // `domcontentloaded` et non `networkidle` : dans cet environnement la CDN
  // de polices est bloquée et se fait réessayer, donc le réseau ne devient
  // JAMAIS inactif et `goto` expirait au bout de 30 s. On n'a de toute façon
  // pas besoin du réseau : l'attente utile est celle du contenu, juste après.
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Attendre du CONTENU, pas un délai : `networkidle` + un timer fixe laissait
  // parfois capturer avant le premier rendu de React, et le PNG sortait blanc
  // — une capture blanche ressemble à une régression alors que la page va
  // bien, ce qui rend la vérification visuelle inutilisable.
  await page.waitForFunction(
    () => (document.body.innerText || '').trim().length > 200,
    { timeout: 15_000 },
  );
  // Laisse le graphique (lightweight-charts) se dessiner.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  const file = join(OUT, `${view}${DARK ? '-dark' : ''}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`✓ ${view} → ${file}`);
}

await browser.close();

if (errors.length) {
  console.log(`\n⚠ ${errors.length} erreur(s) console :`);
  for (const e of [...new Set(errors)].slice(0, 12)) console.log('  ' + e.slice(0, 220));
  process.exitCode = 1;
} else {
  console.log('\nAucune erreur console.');
}

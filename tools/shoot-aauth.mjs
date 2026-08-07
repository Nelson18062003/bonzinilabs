// DEV-ONLY: capture les maquettes « connexion admin sans mot de passe »
// (src/__screenshot__/adminAuthLayout.tsx) via le harness /screenshot.html.
// Aucun appel réseau : les écrans sont statiques.
//
//   npx vite --host --port 8080 &
//   node tools/shoot-aauth.mjs            # thème clair
//   THEMES=light,dark node tools/shoot-aauth.mjs
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('shots/aauth', { recursive: true });

const PORT = process.env.PORT || '8080';
const THEMES = (process.env.THEMES || 'light').split(',');
const SCREENS = process.env.ONLY
  ? process.env.ONLY.split(',')
  : [
      'aauth-now',
      'aauth-email',
      'aauth-otp-email',
      'aauth-2fa-intro',
      'aauth-2fa-install',
      'aauth-2fa-qr',
      'aauth-2fa-verify',
      'aauth-backup',
      'aauth-passkey',
      'aauth-done',
      'aauth-daily',
      'aauth-daily-totp',
      'aauth-recover',
      'aauth-backup-use',
    ];

/** DM Sans servi depuis public/fonts (voir la route ci-dessous). */
const LOCAL_FONT_CSS = [400, 500, 600, 700, 800, 900]
  .map(
    (w) => `@font-face{font-family:'DM Sans';font-style:normal;font-weight:${w};font-display:swap;
      src:url(http://127.0.0.1:${PORT}/fonts/dm-sans-latin-${w}-normal.woff) format('woff')}`,
  )
  .join('\n');

const iPhone = devices['iPhone 14'];
// PW_CHROMIUM : chemin d'un Chromium déjà présent sur la machine (CI / conteneur
// où `npx playwright install` n'est pas rejoué). Sinon, binaire par défaut.
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);

for (const theme of THEMES) {
  const ctx = await browser.newContext({
    ...iPhone,
    deviceScaleFactor: 2, // 780px de large — net sans peser 3x
    colorScheme: theme,
    locale: 'fr-FR',
  });
  const page = await ctx.newPage();
  // Hors-ligne : Google Fonts est injoignable → on sert DM Sans depuis
  // public/fonts pour que la capture ait la vraie typographie de l'app.
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: LOCAL_FONT_CSS }),
  );
  for (const key of SCREENS) {
    await page.goto(`http://127.0.0.1:${PORT}/screenshot.html?screen=${key}&theme=${theme}&font=dm`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(500);
    const suffix = THEMES.length > 1 ? `-${theme}` : '';
    await page.screenshot({ path: `shots/aauth/${key}${suffix}.png`, fullPage: true });
    console.log(`OK ${key}${suffix}`);
  }
  await ctx.close();
}

await browser.close();

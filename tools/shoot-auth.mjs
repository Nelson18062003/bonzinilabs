// DEV-ONLY: capture the admin auth screens from the running dev server
// (npx vite --host --port 8080) at iPhone size, in French.
//
// All Supabase traffic is aborted, so the screens render exactly as they do
// offline — nothing real is contacted and no account is touched.
//
//   node tools/shoot-auth.mjs                  # every scenario, light theme
//   ONLY=avant-email THEMES=light,dark node tools/shoot-auth.mjs
//
// Mirrors tools/shoot.mjs (Treasury harness) for the auth surface.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? 'shots/auth';
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE ?? 'http://localhost:8080';
const iPhone = devices['iPhone 14'];
const THEMES = (process.env.THEMES ?? 'light').split(',');

const EMAIL = 'papa@gmail.com';

/** Étape 1 → 2 : renseigner l'adresse et valider. */
async function goToMethods(page) {
  await page.getByLabel(/adresse email/i).fill(EMAIL);
  await page.getByRole('button', { name: /^continuer$/i }).click();
  await page.waitForTimeout(700);
}

/**
 * Each scenario: navigate, optionally drive the UI, then screenshot.
 * `act` receives the Playwright page after the first paint.
 */
const SCENARIOS = {
  // ── Nouvel écran (après) — parcours en 3 temps ─────────────────────────
  // 1. L'adresse, seule question posée. Vide au premier passage…
  'apres-1-email': {
    path: '/m/login',
  },
  // …pré-remplie au retour, et toujours modifiable.
  'apres-1-email-connu': {
    path: '/m/login',
    remember: EMAIL,
  },
  // 2. Les moyens. Sans capteur biométrique : code email + Google.
  'apres-2-moyens': {
    path: '/m/login',
    remember: EMAIL,
    act: goToMethods,
  },
  // 2 bis. Sur un téléphone avec Face ID / empreinte, la clé s'ajoute.
  'apres-2-moyens-appareil': {
    path: '/m/login',
    remember: EMAIL,
    passkeyDevice: true,
    act: goToMethods,
  },
  // 3. Le code à 6 chiffres.
  'apres-3-code': {
    path: '/m/login',
    remember: EMAIL,
    act: async (page) => {
      await goToMethods(page);
      await page.getByRole('button', { name: /recevoir un code par email/i }).click();
      await page.waitForTimeout(900);
      // OtpField = une case par chiffre, chacune étiquetée « Chiffre N sur 6 »
      // (6 = réglage Email OTP Length du projet). On laisse la dernière vide :
      // la remplir déclencherait la validation automatique (onComplete) et
      // l'écran basculerait pendant la capture.
      const digits = '48392';
      for (let i = 0; i < digits.length; i += 1) {
        await page.getByLabel(`Chiffre ${i + 1} sur 6`).fill(digits[i]);
      }
    },
  },
  // Écran « Connexion rapide » — rendu via le harness (/screenshot.html),
  // qui fournit un contexte admin factice, sinon la route est protégée.
  'apres-appareils': {
    path: '/screenshot.html?screen=more-passkeys',
    passkeyDevice: true,
    credentials: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        device_label: 'iPhone de Papa',
        backed_up: true,
        created_at: '2026-08-01T09:41:00Z',
        last_used_at: '2026-08-09T07:12:00Z',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        device_label: 'Mac',
        backed_up: false,
        created_at: '2026-07-14T15:20:00Z',
        last_used_at: null,
      },
    ],
  },
};

const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(SCENARIOS);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

for (const theme of THEMES) {
  for (const name of only) {
    const scenario = SCENARIOS[name];
    if (!scenario) {
      console.log(`skip ${name} (unknown scenario)`);
      continue;
    }

    const ctx = await browser.newContext({
      ...iPhone,
      colorScheme: theme,
      deviceScaleFactor: 3,
      // i18n detection reads `navigator` — the production audience is francophone.
      locale: 'fr-FR',
    });

    // Nothing real is contacted. Playwright matches routes in reverse
    // registration order, so the catch-all goes first and the OTP stub second:
    // the code screen is then reached exactly as it would be in production.
    await ctx.route('**/*supabase.co/**', (r) => r.abort());
    await ctx.route('**/auth/v1/otp**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    if (scenario.remember) {
      await ctx.addInitScript((value) => {
        localStorage.setItem('bonzini-admin-last-email', value);
      }, scenario.remember);
    }

    // Marqueur local « une clé est enrôlée ici » : sans lui l'écran de
    // connexion ne met pas la clé d'accès en avant (comportement voulu).
    if (scenario.passkeyDevice) {
      await ctx.addInitScript(() => localStorage.setItem('bonzini-admin-passkey', '1'));
    }

    // Fixture pour la liste des appareils (l'écran interroge Supabase, coupé ici).
    if (scenario.credentials) {
      await ctx.route('**/rest/v1/webauthn_credentials*', (r) =>
        r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(scenario.credentials),
        }),
      );
    }

    await ctx.addInitScript(() => {
      // Google Fonts is unreachable from the sandbox, which would silently swap
      // DM Sans for a fallback face. Serve the same family from public/fonts so
      // the capture matches what production renders.
      const face = [400, 500, 600, 700, 800, 900]
        .map((w) => `@font-face{font-family:"DM Sans";font-style:normal;font-weight:${w};font-display:block;src:url("/fonts/dm-sans-latin-${w}-normal.woff") format("woff");}`)
        .join('');
      // The React Query devtools button is dev-only; it must not appear in a
      // screenshot meant to show production.
      const hideDevtools = '.tsqd-parent-container,[data-tsqd-parent-container]{display:none !important;}';
      document.addEventListener('DOMContentLoaded', () => {
        const el = document.createElement('style');
        el.textContent = face + hideDevtools;
        document.head.appendChild(el);
      });
    });

    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    // Authenticator virtuel (CDP) : un Chromium sans capteur répond « non » à
    // isUserVerifyingPlatformAuthenticatorAvailable(), et le bouton resterait
    // caché. Ceci simule un téléphone avec Face ID / empreinte.
    if (scenario.passkeyDevice || scenario.authenticator) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('WebAuthn.enable');
      await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      });
    }

    await page.goto(BASE + scenario.path, { waitUntil: 'networkidle' });
    if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(1200); // entrance animations

    if (scenario.act) await scenario.act(page);
    await page.waitForTimeout(600);

    const file = `${OUT}/${name}-${theme}.png`;
    await page.screenshot({ path: file });
    console.log(`${file}${errors.length ? `  ⚠ ${errors.length} page error(s)` : ''}`);
    if (errors.length) console.log('   ' + errors.slice(0, 2).join('\n   '));
    await ctx.close();
  }
}

await browser.close();

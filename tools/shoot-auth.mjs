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

/**
 * Each scenario: navigate, optionally drive the UI, then screenshot.
 * `act` receives the Playwright page after the first paint.
 */
const SCENARIOS = {
  // ── État actuel (avant) ────────────────────────────────────────────────
  'avant-email': {
    path: '/m/login',
  },
  'avant-password': {
    path: '/m/login',
    act: async (page) => {
      await page.getByLabel(/adresse email/i).fill(EMAIL);
      await page.getByRole('button', { name: /continuer/i }).click();
      await page.waitForTimeout(700);
    },
  },

  // ── Nouvel écran (après) ───────────────────────────────────────────────
  // Premier passage sur cet appareil : aucune adresse mémorisée.
  'apres-choix': {
    path: '/m/login',
  },
  // Retour sur un appareil déjà utilisé : l'adresse est connue.
  'apres-choix-connu': {
    path: '/m/login',
    remember: EMAIL,
  },
  'apres-email': {
    path: '/m/login',
    act: async (page) => {
      await page.getByRole('button', { name: /recevoir un code/i }).click();
      await page.waitForTimeout(600);
      await page.getByLabel(/adresse email/i).fill(EMAIL);
    },
  },
  'apres-code': {
    path: '/m/login',
    remember: EMAIL,
    act: async (page) => {
      await page.getByRole('button', { name: /recevoir un code/i }).click();
      await page.waitForTimeout(900);
      // OtpField = une case par chiffre, chacune étiquetée « Chiffre N sur 8 »
      // (8 = réglage Email OTP Length du projet). On laisse la dernière vide :
      // la remplir déclencherait la validation automatique (onComplete) et
      // l'écran basculerait pendant la capture.
      const digits = '4839207';
      for (let i = 0; i < digits.length; i += 1) {
        await page.getByLabel(`Chiffre ${i + 1} sur 8`).fill(digits[i]);
      }
    },
  },
  // Une clé d'accès est enrôlée sur cet appareil : elle passe en tête.
  'apres-passkey': {
    path: '/m/login',
    remember: EMAIL,
    passkeyDevice: true,
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
  'apres-mot-de-passe-choisi': {
    path: '/screenshot.html?screen=more-password',
    act: async (page) => {
      await page.getByLabel(/nouveau mot de passe/i).fill('bateau-jaune-42');
      await page.getByLabel(/confirmer le mot de passe/i).fill('bateau-jaune-42');
    },
  },
  'apres-password': {
    path: '/m/login',
    remember: EMAIL,
    act: async (page) => {
      await page.getByRole('button', { name: /utiliser un mot de passe/i }).click();
      await page.waitForTimeout(600);
      await page.getByLabel(/mot de passe/i).first().fill('mon-mot-de-passe');
    },
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
    if (scenario.passkeyDevice) {
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

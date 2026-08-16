// DEV-ONLY: before/after captures for the dépôts & paiements changes.
//
// Same contract as tools/shoot.mjs — the harness (/screenshot.html) renders one
// screen with a full-permission fake admin, and every Supabase call is
// intercepted here and answered with a fixture. Nothing real is contacted.
//
// The fixture amounts are chosen to expose the ¥ bug: 3 500 000 XAF at
// 11 000 ¥/1M is EXACTLY 38 500 ¥, so the old formatter printed "¥ 38 500,00"
// and the new one prints "¥ 38 500".
//
//   OUT=shots/after node tools/shoot-admin-ba.mjs
//   OUT=shots/before ONLY=payment-detail node tools/shoot-admin-ba.mjs
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT || 'shots/ba';
mkdirSync(OUT, { recursive: true });

const BASE = `http://localhost:${process.env.PORT || 8080}/screenshot.html`;
const THEMES = (process.env.THEMES || 'dark').split(',');

/** Screens to shoot, with the viewport each one is designed for. */
const ALL = {
  'payment-detail': 'phone',
  'payment-new': 'phone',
  'deposit-new': 'phone',
  'deposit-detail': 'phone',
  'desk-payments': 'desktop',
};
const SCREENS = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(ALL);

const iPhone = devices['iPhone 14'];
const VIEWPORT = {
  phone: { ...iPhone },
  // 1728 = 16" MacBook Pro — the `standard` tier.
  desktop: { viewport: { width: 1728, height: 1080 }, deviceScaleFactor: 2 },
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE',
};

// ── Fixtures ────────────────────────────────────────────────────────────────
const client = {
  user_id: 'u1',
  first_name: 'Esthere',
  last_name: 'Tchoumkeu Tchamba',
  phone: '+237690000001',
  company_name: null,
  email: 'esthere@example.com',
  kyc_status: 'verified',
};

const RATE = 11000; // ¥ per 1 000 000 XAF

const mkPayment = (id, ref, xaf, status, method) => ({
  id,
  reference: ref,
  user_id: 'u1',
  amount_xaf: xaf,
  amount_rmb: Math.round((xaf * RATE) / 1_000_000),
  exchange_rate: RATE,
  method,
  status,
  created_at: '2026-08-14T09:12:00Z',
  processed_at: null,
  rejection_reason: null,
  admin_comment: null,
  beneficiary_name: 'Esther',
  beneficiary_phone: null,
  beneficiary_email: null,
  beneficiary_bank_name: null,
  beneficiary_bank_account: null,
  beneficiary_qr_code_url: null,
  beneficiary_notes: null,
  beneficiary_identifier: null,
  proof_count: 1,
  profiles: client,
});

// 3 500 000 XAF → exactly 38 500 ¥ — the screenshot in the bug report.
const payments = [
  mkPayment('py1', 'BZ-PY-2026-0594', 3_500_000, 'processing', 'alipay'),
  mkPayment('py2', 'BZ-PY-2026-0593', 1_200_000, 'ready_for_payment', 'wechat'),
  mkPayment('py3', 'BZ-PY-2026-0592', 8_000_000, 'completed', 'bank_transfer'),
  mkPayment('py4', 'BZ-PY-2026-0591', 450_000, 'processing', 'cash'),
  mkPayment('py5', 'BZ-PY-2026-0590', 15_000_000, 'completed', 'alipay'),
  mkPayment('py6', 'BZ-PY-2026-0589', 2_750_000, 'ready_for_payment', 'alipay'),
];

const paymentProofs = [
  {
    id: 'pr1',
    payment_id: 'py1',
    uploaded_by: 'demo',
    uploaded_by_type: 'admin',
    file_name: 'qr_alipay.png',
    file_url: 'https://placehold.co/640x360/1f2937/e5e7eb.png?text=Preuve',
    file_type: 'image/png',
    description: 'Preuve de paiement Bonzini',
    created_at: '2026-08-14T10:00:00Z',
  },
];

const deposit = {
  id: 'd1',
  reference: 'BZ-DP-2026-0231',
  user_id: 'u1',
  amount_xaf: 2_000_000,
  method: 'bank_transfer',
  status: 'proof_submitted',
  bank_name: 'UBA',
  agency_name: null,
  admin_comment: null,
  created_at: '2026-08-15T08:30:00Z',
  validated_at: null,
  rejection_reason: null,
  profiles: client,
  clients: client,
};

const wallet = { user_id: 'u1', balance_xaf: 12_500_000, updated_at: '2026-08-15T08:30:00Z' };

// Field names must match the DailyRate type exactly — `rate_*`, not
// `base_rate_*`. getBaseRate() reads them directly, so a near-miss silently
// produces ¥NaN in the wizard.
const dailyRate = {
  id: 'r1',
  is_active: true,
  rate_alipay: RATE,
  rate_wechat: RATE,
  rate_virement: RATE,
  rate_cash: RATE,
  effective_at: '2026-08-16T06:00:00Z',
  created_at: '2026-08-16T06:00:00Z',
  created_by: null,
};

const paymentStats = { toProcess: 3, inProgress: 2, completed: 2, total: 6, today_amount_rmb: 38_500 };

function respond(url) {
  const one = (list) => {
    const m = url.match(/id=eq\.([^&]+)/);
    return m ? (list.find((x) => x.id === decodeURIComponent(m[1])) ?? null) : list;
  };

  if (url.includes('/rpc/get_payment_stats')) return paymentStats;
  if (url.includes('/rpc/get_deposit_stats')) return { pending: 4, validated: 12, total: 16 };
  if (url.includes('/rpc/is_admin')) return true;
  if (url.includes('/payment_proofs')) return paymentProofs;
  if (url.includes('/payment_timeline_events')) return [];
  if (url.includes('/deposit_proofs')) return [];
  if (url.includes('/deposit_timeline_events')) return [];
  if (url.includes('/payments')) return one(payments);
  if (url.includes('/deposits')) return one([deposit]);
  if (url.includes('/wallets')) return url.includes('user_id=eq.') ? wallet : [wallet];
  if (url.includes('/clients')) return url.includes('user_id=eq.') ? client : [client];
  if (url.includes('/daily_rates')) return url.includes('limit=1') ? dailyRate : [dailyRate];
  if (url.includes('/beneficiaries')) return [];
  if (url.includes('/user_roles')) return [];
  return [];
}


/**
 * Walk a screen to the state that actually changed.
 *
 * Both creation wizards open on step 1 ("Quel client ?"), and the upload zones
 * live several steps in — shooting the default state would compare two
 * identical screens and prove nothing. Each step is best-effort: a selector that
 * moves should degrade to a partial shot, not kill the run.
 */
async function drive(page, screen) {
  // Exact match, and buttons only: a substring match on "Nouveau" also hits the
  // header "Nouveau paiement", which is the first such node in DOM order.
  const tap = async (name, wait = 700) => {
    const el = page.getByRole('button', { name, exact: true }).first();
    if (await el.count()) {
      await el.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(wait);
      return true;
    }
    return false;
  };
  const tapText = async (text, wait = 700) => {
    const el = page.locator(`text="${text}"`).first();
    if (await el.count()) {
      await el.click({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(wait);
      return true;
    }
    return false;
  };
  const next = () => tap('Suivant');

  try {
    if (screen === 'deposit-new') {
      await tapText('Esthere Tchoumkeu Tchamba');    // 1 · client
      await next();
      await page.keyboard.type('2000000');           // 2 · montant (autofocus)
      await page.waitForTimeout(300);
      await next();
      await tapText('Wave');                        // 3 · famille → récap direct
      await page.waitForTimeout(900);
      // The recap scrolls INSIDE its own container, so fullPage alone stops at
      // the fold — bring the proofs card into view explicitly.
      await page.getByText('Preuves', { exact: false }).first()
        .scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(600);
    }

    if (screen === 'payment-new') {
      await tapText('Esthere Tchoumkeu Tchamba');    // 1 · client
      await next();
      await tapText('Alipay');                      // 2 · mode
      await next();
      await page.keyboard.type('3500000');           // 3 · montant
      await page.waitForTimeout(300);
      await next();
      await tap('Nouveau');                     // 4 · onglet « nouveau » → zone QR
      await page.waitForTimeout(900);
    }

    if (screen === 'deposit-detail') {
      // The upload sheet is where the paste zone lives.
      (await tap('Ajouter une preuve')) || (await tapText('Ajouter une preuve')) || (await tap('+ Ajouter'));
      await page.waitForTimeout(900);
    }
  } catch {
    // Partial walk still yields a usable shot.
  }
}

// ── Capture ─────────────────────────────────────────────────────────────────
// The repo pins a Playwright whose bundled Chromium build differs from the one
// provisioned in this environment; launch the provisioned binary directly
// rather than downloading a second copy.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

for (const theme of THEMES) {
  for (const screen of SCREENS) {
    const kind = ALL[screen] ?? 'phone';
    const ctx = await browser.newContext({ ...VIEWPORT[kind], colorScheme: theme });
    const page = await ctx.newPage();

    await page.route('**/*supabase.co/**', (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
      const body = respond(req.url());
      return route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    });
    // Proof thumbnails point at a placeholder host; stub it so the layout is
    // real without reaching the network.
    await page.route('**/placehold.co/**', (route) =>
      route.fulfill({ status: 200, headers: CORS, contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#2A2738"/><text x="320" y="190" font-size="28" fill="#9B98AD" text-anchor="middle" font-family="sans-serif">Preuve</text></svg>' }),
    );

    try {
      await page.goto(`${BASE}?screen=${screen}&theme=${theme}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForTimeout(2000);
      await drive(page, screen);

      // fullPage stitches by scrolling, which drags `position: sticky` headers
      // down over the first row. Phone screens need it (they scroll past the
      // fold); the desktop queue fits the viewport, so shoot it as-is.
      await page.screenshot({
        path: `${OUT}/${screen}-${theme}.png`,
        fullPage: kind === 'phone',
      });
      console.log(`OK  ${OUT}/${screen}-${theme}.png`);
    } catch (e) {
      console.log(`ERR ${screen}-${theme}: ${e.message}`);
    }
    await ctx.close();
  }
}

await browser.close();
console.log('done');

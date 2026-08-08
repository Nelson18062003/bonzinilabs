/**
 * Desktop console — design showcase captures.
 *
 * Drives the real application (real components, real hooks, real routing) with
 * a fake super_admin session and a Supabase layer answered from
 * `fixtures/consoleFixtures.ts`. The point is to review the console *populated*:
 * empty states hide density, column widths and number alignment.
 *
 * Output → docs/desktop-mockups/v2/{light,dark}/<name>.png
 * Run:  PW_CHROMIUM_PATH=… npx playwright test --config=playwright.qa.config.ts \
 *         --grep desktop-showcase
 */
import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import {
  ADMIN_USER,
  ADMIN_ROLES,
  AUDIT_LOGS,
  CHAT_STATS,
  CLIENTS,
  CONVERSATIONS,
  DAILY_RATE,
  DASHBOARD_STATS,
  DEPOSITS,
  DEPOSIT_STATS,
  PAYMENTS,
  ROLE,
  SESSION,
  TREASURY_BALANCES,
  TREASURY_DASHBOARD,
  WALLETS,
} from './fixtures/consoleFixtures';

const OUT = 'docs/desktop-mockups/v2';

const ROUTES: [string, string][] = [
  ['01-dashboard', '/m'],
  ['02-deposits', '/m/deposits'],
  ['03-payments', '/m/payments'],
  ['04-clients', '/m/clients'],
  ['05-treasury', '/m/more/treasury'],
  ['06-rates', '/m/more/rates'],
  ['07-admins', '/m/more/admins'],
  ['08-audit-log', '/m/more/history'],
  ['09-support', '/m/support'],
  ['10-assistant', '/m/assistant'],
  ['11-analytics', '/m/dashboard'],
  ['12-treasury-analysis', '/m/more/treasury/dashboard'],
];

/** Extract a `col=eq.value` filter from a PostgREST query string. */
function eqFilter(params: URLSearchParams, col: string): string | null {
  const raw = params.get(col);
  return raw?.startsWith('eq.') ? raw.slice(3) : null;
}

/**
 * Minimal PostgREST emulator: enough to satisfy the admin hooks (table reads,
 * `eq` filters, `head`+count requests, `.single()` object responses, RPCs).
 */
function resolve(url: URL, method: string, accept: string, sc: Scenario = {}): { body: unknown; count: number } {
  const path = url.pathname;
  const params = url.searchParams;
  const table = path.replace(/^\/rest\/v1\//, '').split('?')[0];
  const deposits = (sc.deposits ?? DEPOSITS) as Record<string, unknown>[];

  const list = (rows: unknown[]) => ({ body: rows, count: rows.length });

  if (path.includes('/auth/v1/user')) return { body: ADMIN_USER, count: 1 };
  if (path.includes('/auth/v1/token')) return { body: SESSION, count: 1 };
  if (path.includes('/auth/v1/')) return { body: {}, count: 0 };

  // ── RPCs ──
  if (path.includes('/rest/v1/rpc/')) {
    const fn = path.split('/rpc/')[1];
    switch (fn) {
      case 'get_dashboard_stats': return { body: DASHBOARD_STATS, count: 1 };
      case 'get_deposit_stats': return { body: sc.depositStats ?? DEPOSIT_STATS, count: 1 };
      case 'get_treasury_dashboard': return { body: TREASURY_DASHBOARD, count: 1 };
      case 'get_wac_usdt': return { body: TREASURY_DASHBOARD.wac_usdt_current, count: 1 };
      case 'get_usdt_stock': return { body: sc.usdtStock ?? TREASURY_DASHBOARD.stock_usdt, count: 1 };
      case 'get_top_counterparties': return { body: { top: [] }, count: 0 };
      case 'get_chat_admin_stats': return { body: CHAT_STATS, count: 1 };
      default: return { body: [], count: 0 };
    }
  }

  switch (table) {
    case 'user_roles': {
      // The auth check filters on the caller's id and reads a single row —
      // returning the whole table there makes `maybeSingle()` throw.
      const uid = eqFilter(params, 'user_id');
      if (uid) {
        const row = { ...ROLE, role: sc.role ?? ROLE.role, id: 'r-0', user_id: uid, email: ADMIN_USER.email };
        return accept.includes('vnd.pgrst.object') ? { body: row, count: 1 } : list([row]);
      }
      return accept.includes('vnd.pgrst.object') ? { body: ADMIN_ROLES[0], count: 1 } : list(ADMIN_ROLES);
    }

    case 'clients':
      return list(CLIENTS);

    case 'wallets': {
      const uid = eqFilter(params, 'user_id');
      const rows = uid ? WALLETS.filter((w) => w.user_id === uid) : WALLETS;
      return accept.includes('vnd.pgrst.object') ? { body: rows[0] ?? null, count: rows.length } : list(rows);
    }

    case 'deposits': {
      const status = eqFilter(params, 'status');
      const id = eqFilter(params, 'id');
      let rows = deposits;
      if (status) rows = rows.filter((d) => d.status === status);
      if (id) rows = rows.filter((d) => d.id === id);
      const statuses = params.get('status')?.startsWith('in.')
        ? params.get('status')!.slice(4, -1).split(',').map((s) => s.replace(/"/g, ''))
        : null;
      if (statuses) rows = deposits.filter((d) => statuses.includes(String(d.status)));
      return accept.includes('vnd.pgrst.object') ? { body: rows[0] ?? null, count: rows.length } : list(rows);
    }

    case 'payments': {
      const status = eqFilter(params, 'status');
      const id = eqFilter(params, 'id');
      let rows = PAYMENTS as Record<string, unknown>[];
      const statuses = params.get('status')?.startsWith('in.')
        ? params.get('status')!.slice(4, -1).split(',').map((s) => s.replace(/"/g, ''))
        : null;
      if (statuses) rows = rows.filter((p) => statuses.includes(String(p.status)));
      else if (status) rows = rows.filter((p) => p.status === status);
      if (id) rows = rows.filter((p) => p.id === id);
      return accept.includes('vnd.pgrst.object') ? { body: rows[0] ?? null, count: rows.length } : list(rows);
    }

    case 'daily_rates':
      return accept.includes('vnd.pgrst.object') ? { body: DAILY_RATE, count: 1 } : list([DAILY_RATE]);

    case 'admin_audit_logs':
      return list(AUDIT_LOGS);

    case 'chat_conversations':
      return list(CONVERSATIONS);

    case 'treasury_account_balances':
      return list(TREASURY_BALANCES);

    default:
      return accept.includes('vnd.pgrst.object') ? { body: null, count: 0 } : list([]);
  }
}

/**
 * A capture scenario. The default one is "super admin, healthy platform";
 * overrides let a single test prove a state the happy path never shows —
 * a restricted role, an empty queue, a treasury alert.
 */
interface Scenario {
  /** Overrides the caller's role, which drives what the rail renders. */
  role?: string;
  /** Replaces the deposit dataset (use `[]` for the empty state). */
  deposits?: unknown[];
  depositStats?: Record<string, number>;
  /** Overrides `get_usdt_stock` — negative triggers the treasury alert. */
  usdtStock?: number;
}

function install(theme: 'light' | 'dark', scenario: Scenario = {}) {
  return async ({ context }: { context: import('@playwright/test').BrowserContext }) => {
    await context.addInitScript(
      ([session, mode]) => {
        window.localStorage.setItem('bonzini-admin-auth', session as string);
        window.localStorage.setItem('theme', mode as string);
        // Start every capture from a known chrome state.
        window.localStorage.setItem('bonzini-desktop-rail-collapsed', '0');
        window.localStorage.setItem(
          'bonzini-desktop-nav-open',
          JSON.stringify(['tresorerie', 'marche', 'relation', 'systeme']),
        );
      },
      [JSON.stringify(SESSION), theme],
    );

    await context.route(/mock\.supabase\.co/, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const accept = req.headers()['accept'] || '';
      const { body, count } = resolve(url, req.method(), accept, scenario);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'content-range': `0-${Math.max(0, count - 1)}/${count}`,
          'access-control-allow-origin': '*',
          // Without this the browser hides content-range from the JS layer and
          // every `count: 'exact'` query silently reads back as 0.
          'access-control-expose-headers': 'content-range, content-length',
        },
        body: req.method() === 'HEAD' ? '' : JSON.stringify(body),
      });
    });
  };
}

async function shoot(page: import('@playwright/test').Page, theme: string, name: string, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.getByText("Console d'opérations").first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  // The React Query devtools launcher is a dev-only floating button; it would
  // sit on top of the sidebar in every capture.
  await page.addStyleTag({ content: '.tsqd-parent-container,[aria-label*="React Query"]{display:none !important}' }).catch(() => {});
  await page.waitForTimeout(1_400); // let lazy chunks + charts settle
  mkdirSync(`${OUT}/${theme}`, { recursive: true });
  await page.screenshot({ path: `${OUT}/${theme}/${name}.png` });
}

test.describe('light', () => {
  test.use({ colorScheme: 'light' });
  test.beforeEach(install('light'));
  for (const [name, path] of ROUTES) {
    test(`light ${name}`, async ({ page }) => shoot(page, 'light', name, path));
  }
  test('light 13-command-palette', async ({ page }) => {
    await page.goto('/m', { waitUntil: 'domcontentloaded' });
    await page.getByText("Console d'opérations").first().waitFor({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(900);
    await page.keyboard.press('Control+k');
    await page.keyboard.type('tré');
    await page.waitForTimeout(600);
    mkdirSync(`${OUT}/light`, { recursive: true });
    await page.screenshot({ path: `${OUT}/light/13-command-palette.png` });
  });
  test('light 14-deposit-inspector', async ({ page }) => shoot(page, 'light', '14-deposit-inspector', '/m/deposits/d-0'));
  test('light 19-notifications', async ({ page }) => {
    await page.goto('/m', { waitUntil: 'domcontentloaded' });
    await page.getByText("Console d'opérations").first().waitFor({ timeout: 15_000 }).catch(() => {});
    await page.addStyleTag({ content: '.tsqd-parent-container,[aria-label*="React Query"]{display:none !important}' }).catch(() => {});
    await page.waitForTimeout(1_200);
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await page.waitForTimeout(500);
    mkdirSync(`${OUT}/light`, { recursive: true });
    await page.screenshot({ path: `${OUT}/light/19-notifications.png` });
  });
  test('light 15-rail-collapsed', async ({ page }) => {
    await page.goto('/m/payments', { waitUntil: 'domcontentloaded' });
    await page.getByText("Console d'opérations").first().waitFor({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(900);
    await page.keyboard.press('Control+b');
    await page.waitForTimeout(500);
    mkdirSync(`${OUT}/light`, { recursive: true });
    await page.screenshot({ path: `${OUT}/light/15-rail-collapsed.png` });
  });
});

test.describe('dark', () => {
  test.use({ colorScheme: 'dark' });
  test.beforeEach(install('dark'));
  for (const [name, path] of ROUTES.slice(0, 8)) {
    test(`dark ${name}`, async ({ page }) => shoot(page, 'dark', name, path));
  }
});

/**
 * States the happy path never shows. Each one is a claim about the console that
 * a reviewer should be able to check with their eyes rather than take on trust.
 */
test.describe('states', () => {
  test.use({ colorScheme: 'light' });

  // Claim: the rail is permission-aware. An `ops` profile has no treasury and
  // no user management, so those sections must not exist at all.
  test.describe('role ops', () => {
    test.beforeEach(install('light', { role: 'ops' }));
    test('light 16-role-ops', async ({ page }) => shoot(page, 'light', '16-role-ops', '/m'));
  });

  // Claim: an empty queue is a designed state, not a blank page.
  test.describe('empty', () => {
    test.beforeEach(
      install('light', {
        deposits: [],
        depositStats: { total: 0, to_process: 0, pending_correction: 0, validated: 0, rejected: 0, today_amount: 0, today_count: 0 },
      }),
    );
    test('light 17-deposits-empty', async ({ page }) => shoot(page, 'light', '17-deposits-empty', '/m/deposits'));
  });

  // Claim: a negative USDT stock — the one treasury state that costs money —
  // is impossible to miss.
  test.describe('treasury alert', () => {
    test.beforeEach(install('light', { usdtStock: -1_240.5 }));
    test('light 18-treasury-alert', async ({ page }) => shoot(page, 'light', '18-treasury-alert', '/m/more/treasury'));
  });
});

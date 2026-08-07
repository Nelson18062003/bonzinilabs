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
function resolve(url: URL, method: string, accept: string): { body: unknown; count: number } {
  const path = url.pathname;
  const params = url.searchParams;
  const table = path.replace(/^\/rest\/v1\//, '').split('?')[0];

  const list = (rows: unknown[]) => ({ body: rows, count: rows.length });

  if (path.includes('/auth/v1/user')) return { body: ADMIN_USER, count: 1 };
  if (path.includes('/auth/v1/token')) return { body: SESSION, count: 1 };
  if (path.includes('/auth/v1/')) return { body: {}, count: 0 };

  // ── RPCs ──
  if (path.includes('/rest/v1/rpc/')) {
    const fn = path.split('/rpc/')[1];
    switch (fn) {
      case 'get_dashboard_stats': return { body: DASHBOARD_STATS, count: 1 };
      case 'get_deposit_stats': return { body: DEPOSIT_STATS, count: 1 };
      case 'get_treasury_dashboard': return { body: TREASURY_DASHBOARD, count: 1 };
      case 'get_wac_usdt': return { body: TREASURY_DASHBOARD.wac_usdt_current, count: 1 };
      case 'get_usdt_stock': return { body: TREASURY_DASHBOARD.stock_usdt, count: 1 };
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
        const row = { ...ROLE, id: 'r-0', user_id: uid, email: ADMIN_USER.email };
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
      let rows = DEPOSITS as Record<string, unknown>[];
      if (status) rows = rows.filter((d) => d.status === status);
      if (id) rows = rows.filter((d) => d.id === id);
      const statuses = params.get('status')?.startsWith('in.')
        ? params.get('status')!.slice(4, -1).split(',').map((s) => s.replace(/"/g, ''))
        : null;
      if (statuses) rows = (DEPOSITS as Record<string, unknown>[]).filter((d) => statuses.includes(String(d.status)));
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

function install(theme: 'light' | 'dark') {
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
      const { body, count } = resolve(url, req.method(), accept);
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

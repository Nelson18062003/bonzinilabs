/**
 * Shared harness for every desktop-console spec: a fake super_admin session and
 * a minimal PostgREST emulator answering from `consoleFixtures`.
 *
 * Extracted so the showcase captures and the metrology assertions drive the
 * application through exactly the same backend — a measurement taken against a
 * different data shape than the screenshot would be worth nothing.
 */
import type { BrowserContext } from '@playwright/test';
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
} from './consoleFixtures';

/**
 * A capture/measurement scenario. The default is "super admin, healthy
 * platform"; overrides let a single test prove a state the happy path never
 * shows — a restricted role, an empty queue, a treasury alert.
 */
export interface Scenario {
  /** Overrides the caller's role, which drives what the rail renders. */
  role?: string;
  /** Replaces the deposit dataset (use `[]` for the empty state). */
  deposits?: unknown[];
  depositStats?: Record<string, number>;
  /** Overrides `get_usdt_stock` — negative triggers the treasury alert. */
  usdtStock?: number;
}

/** Routes that carry a toolbar and a table — the ones metrology cares about. */
export const ROUTES_UNDER_TEST: [string, string][] = [
  ['deposits', '/m/deposits'],
  ['payments', '/m/payments'],
  ['clients', '/m/clients'],
  ['admins', '/m/more/admins'],
  ['audit-log', '/m/more/history'],
];

/** Extract a `col=eq.value` filter from a PostgREST query string. */
function eqFilter(params: URLSearchParams, col: string): string | null {
  const raw = params.get(col);
  return raw?.startsWith('eq.') ? raw.slice(3) : null;
}

/** `col=in.(a,b)` → ['a','b'] */
function inFilter(params: URLSearchParams, col: string): string[] | null {
  const raw = params.get(col);
  if (!raw?.startsWith('in.')) return null;
  return raw.slice(4, -1).split(',').map((s) => s.replace(/"/g, ''));
}

/**
 * Minimal PostgREST emulator: enough to satisfy the admin hooks (table reads,
 * `eq`/`in` filters, `head`+count requests, `.single()` object responses, RPCs).
 */
export function resolve(
  url: URL,
  accept: string,
  sc: Scenario = {},
): { body: unknown; count: number } {
  const path = url.pathname;
  const params = url.searchParams;
  const table = path.replace(/^\/rest\/v1\//, '').split('?')[0];
  const deposits = (sc.deposits ?? DEPOSITS) as Record<string, unknown>[];
  const list = (rows: unknown[]) => ({ body: rows, count: rows.length });

  if (path.includes('/auth/v1/user')) return { body: ADMIN_USER, count: 1 };
  if (path.includes('/auth/v1/token')) return { body: SESSION, count: 1 };
  if (path.includes('/auth/v1/')) return { body: {}, count: 0 };

  if (path.includes('/rest/v1/rpc/')) {
    switch (path.split('/rpc/')[1]) {
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
      const statuses = inFilter(params, 'status');
      const status = eqFilter(params, 'status');
      const id = eqFilter(params, 'id');
      let rows = deposits;
      if (statuses) rows = rows.filter((d) => statuses.includes(String(d.status)));
      else if (status) rows = rows.filter((d) => d.status === status);
      if (id) rows = rows.filter((d) => d.id === id);
      return accept.includes('vnd.pgrst.object') ? { body: rows[0] ?? null, count: rows.length } : list(rows);
    }

    case 'payments': {
      const statuses = inFilter(params, 'status');
      const status = eqFilter(params, 'status');
      const id = eqFilter(params, 'id');
      let rows = PAYMENTS as Record<string, unknown>[];
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

/** Playwright `beforeEach` that boots the console into a known state. */
export function installConsole(theme: 'light' | 'dark' = 'light', scenario: Scenario = {}) {
  return async ({ context }: { context: BrowserContext }) => {
    await context.addInitScript(
      ([session, mode]) => {
        window.localStorage.setItem('bonzini-admin-auth', session as string);
        window.localStorage.setItem('theme', mode as string);
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
      const { body, count } = resolve(new URL(req.url()), req.headers()['accept'] || '', scenario);
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

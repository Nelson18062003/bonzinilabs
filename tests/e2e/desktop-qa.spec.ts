/**
 * Desktop admin QA sweep.
 *
 * Fakes an authenticated super_admin (seeded session + intercepted Supabase so
 * no real backend is needed) and visits every desktop admin route at 1440px.
 * For each route it records: uncaught crashes, app-level console errors (network
 * / websocket / asset noise filtered out), whether the desktop shell rendered,
 * and a full-page screenshot. A summary is written to qa-shots/report.json.
 *
 * This is a smoke/visual harness, not a data test: Supabase returns empty data,
 * so screens render in their empty/loading states — enough to catch layout
 * breakage, overlay bugs, import errors and unguarded-data crashes.
 */
import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const USER = {
  id: '00000000-0000-0000-0000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'qa@bonzini.test',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2020-01-01T00:00:00Z',
};
const SESSION = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4070908800, // year ~2099 → never refreshes
  user: USER,
};
const ROLE = { role: 'super_admin', first_name: 'QA', last_name: 'Bot', avatar_url: null, is_disabled: false };
// user_roles read as a list (e.g. useSupportAdmins) needs array rows, not the single auth object.
const ROLE_ROW = { id: 'role-1', user_id: USER.id, first_name: 'QA', last_name: 'Bot', role: 'super_admin', is_disabled: false };
// Correctly-shaped (zeroed) payloads for the object-returning RPCs.
const DASH = {
  purchases: { count: 0, total_xaf: 0, total_usdt: 0, weighted_avg_rate_xaf_per_usdt: 0 },
  sales: { count: 0, total_usdt: 0, total_cny: 0, weighted_avg_rate_cny_per_usdt: 0 },
  client_rate: { count: 0, total_xaf: 0, total_cny: 0, weighted_avg_rate_xaf_per_cny: 0 },
  taux_de_revient_xaf_per_cny: 0,
  wac_usdt_current: 0,
  stock_usdt: 0,
  is_stock_usdt_negative: false,
  benefit_total_xaf: 0,
  capital_immobilized_current_xaf: 0,
};
const STATS = {
  period_days: 7,
  open_conversations: 0,
  closed_conversations: 0,
  unassigned_open: 0,
  total_messages: 0,
  client_messages: 0,
  admin_messages: 0,
  avg_response_seconds_global: 0,
  median_response_seconds_global: 0,
  per_admin: [],
  daily_volume: [],
  response_buckets: { under_1min: 0, one_to_five: 0, five_to_fifteen: 0, over_fifteen: 0 },
};

const ROUTES: [string, string][] = [
  ['dashboard', '/m'],
  ['assistant', '/m/assistant'],
  ['deposits', '/m/deposits'],
  ['payments', '/m/payments'],
  ['clients', '/m/clients'],
  ['treasury-home', '/m/more/treasury'],
  ['treasury-dashboard', '/m/more/treasury/dashboard'],
  ['treasury-balances', '/m/more/treasury/balance-dashboard'],
  ['treasury-accounts', '/m/more/treasury/accounts'],
  ['treasury-inventory', '/m/more/treasury/inventory'],
  ['treasury-operations', '/m/more/treasury/operations'],
  ['treasury-counterparties', '/m/more/treasury/counterparties'],
  ['treasury-purchases', '/m/more/treasury/purchases'],
  ['treasury-sales', '/m/more/treasury/sales'],
  ['treasury-new-purchase', '/m/more/treasury/purchase'],
  ['treasury-new-sale', '/m/more/treasury/sale'],
  ['rates', '/m/more/rates'],
  ['support', '/m/support'],
  ['support-stats', '/m/support/stats'],
  ['admins', '/m/more/admins'],
  ['admin-new', '/m/more/admins/new'],
  ['history', '/m/more/history'],
  ['settings', '/m/more/settings'],
  ['profile', '/m/more/profile'],
  ['more-hub', '/m/more'],
  ['proofs', '/m/more/proofs'],
  ['briefs', '/m/more/briefs'],
  ['notifications', '/m/more/notifications'],
  ['templates', '/m/more/canned-responses'],
  ['quick-replies', '/m/more/quick-replies'],
  ['deposit-new', '/m/deposits/new'],
  ['payment-new', '/m/payments/new'],
  ['client-new', '/m/clients/new'],
  ['deposit-detail', '/m/deposits/00000000-0000-0000-0000-000000000009'],
  ['payment-detail', '/m/payments/00000000-0000-0000-0000-000000000009'],
  ['client-detail', '/m/clients/00000000-0000-0000-0000-000000000009'],
  ['support-convo', '/m/support/00000000-0000-0000-0000-000000000009'],
  ['op-purchase-detail', '/m/more/treasury/purchases/00000000-0000-0000-0000-000000000009'],
  ['counterparty-edit', '/m/more/treasury/counterparties/00000000-0000-0000-0000-000000000009'],
];

const IGNORE =
  /websocket|realtime|Failed to load resource|favicon|ERR_|preload|font|net::|Download the React DevTools|chunk|status of 4|status of 5/i;

type Result = { name: string; path: string; shell: boolean; crashes: string[]; errors: string[] };
const results: Result[] = [];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([key, val]) => window.localStorage.setItem(key as string, val as string),
    ['bonzini-admin-auth', JSON.stringify(SESSION)],
  );
  await context.route(/mock\.supabase\.co/, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    let body: unknown = [];
    if (path.includes('/auth/v1/user')) body = USER;
    else if (path.includes('/auth/v1/token')) body = SESSION;
    else if (path.includes('/auth/v1/')) body = {};
    else if (path.includes('/rest/v1/user_roles')) body = wantsObject ? ROLE : [ROLE_ROW];
    else if (path.endsWith('/rpc/get_treasury_dashboard')) body = DASH;
    else if (path.endsWith('/rpc/get_top_counterparties')) body = { top: [] };
    else if (path.endsWith('/rpc/get_chat_admin_stats')) body = STATS;
    else if (path.includes('/rest/v1/rpc/')) body = [];
    else body = wantsObject ? null : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-0/0' },
      body: JSON.stringify(body),
    });
  });
});

for (const [name, path] of ROUTES) {
  test(name, async ({ page }) => {
    const crashes: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', (e) => crashes.push(e.message));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (!IGNORE.test(t)) errors.push(t.slice(0, 300));
    });

    await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    // Wait for the desktop shell (auth resolves → sidebar renders) or time out.
    const shell = await page
      .getByText('Console admin')
      .first()
      .waitFor({ state: 'visible', timeout: 12_000 })
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(700); // let lazy content settle

    mkdirSync('qa-shots', { recursive: true });
    await page.screenshot({ path: `qa-shots/${name}.png`, fullPage: true }).catch(() => {});

    results.push({ name, path, shell, crashes, errors: [...new Set(errors)] });

    if (crashes.length) console.log(`\n🔴 [${name}] ${path} CRASH:\n  ${crashes.join('\n  ')}`);
    if (errors.length) console.log(`\n🟠 [${name}] ${path} console errors:\n  ${[...new Set(errors)].slice(0, 6).join('\n  ')}`);
    if (!shell) console.log(`\n⚪ [${name}] ${path} — desktop shell did NOT render (redirect/crash?)`);

    expect.soft(crashes, `uncaught crash on ${path}`).toEqual([]);
    expect.soft(shell, `desktop shell rendered on ${path}`).toBe(true);
  });
}

test.afterAll(() => {
  const crashed = results.filter((r) => r.crashes.length);
  const noShell = results.filter((r) => !r.shell);
  const withErrors = results.filter((r) => r.errors.length);
  const summary = {
    total: results.length,
    crashed: crashed.map((r) => r.name),
    noShell: noShell.map((r) => r.name),
    withErrors: withErrors.map((r) => ({ name: r.name, errors: r.errors })),
    results,
  };
  mkdirSync('qa-shots', { recursive: true });
  writeFileSync('qa-shots/report.json', JSON.stringify(summary, null, 2));
  console.log(
    `\n===== QA SUMMARY =====\nroutes: ${results.length}\ncrashed: ${crashed.length} [${crashed.map((r) => r.name).join(', ')}]\nno-shell: ${noShell.length} [${noShell.map((r) => r.name).join(', ')}]\nwith console errors: ${withErrors.length} [${withErrors.map((r) => r.name).join(', ')}]\n======================`,
  );
});

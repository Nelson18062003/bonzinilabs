/**
 * Desktop admin QA — interaction flows with seeded data.
 *
 * Complements desktop-qa.spec.ts (empty-state smoke sweep) by seeding a little
 * Supabase data and driving real interactions on the new desktop chrome:
 *   - the topbar global search dropdown (clients + deposit/payment references)
 *   - the topbar notifications dropdown (derived from deposits/payments)
 *   - a populated deposits table
 * Screenshots land in qa-shots/. Same faked super_admin + Supabase interception.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const USER = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'qa@bonzini.test', app_metadata: {}, user_metadata: {}, created_at: '2020-01-01T00:00:00Z' };
const SESSION = { access_token: 'fake', refresh_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: 4070908800, user: USER };
const ROLE = { role: 'super_admin', first_name: 'QA', last_name: 'Bot', avatar_url: null, is_disabled: false };
const ROLE_ROW = { id: 'role-1', user_id: USER.id, first_name: 'QA', last_name: 'Bot', role: 'super_admin', is_disabled: false };

const NOW = new Date().toISOString();
const CLIENTS = [
  { user_id: 'c1', first_name: 'Awa', last_name: 'Traoré', phone: '+22507010101', company_name: 'Jako Cargo' },
  { user_id: 'c2', first_name: 'Koffi', last_name: 'Mensah', phone: '+22507020202', company_name: null },
];
const DEPOSITS = [
  { id: 'd1', user_id: 'c1', status: 'pending_review', amount_xaf: 250000, amount_rmb: 0, reference: 'BZ-DP-1001', method: 'BANK', created_at: NOW, proof_count: 0 },
  { id: 'd2', user_id: 'c2', status: 'pending_review', amount_xaf: 480000, amount_rmb: 0, reference: 'BZ-DP-1002', method: 'ORANGE_MONEY', created_at: NOW, proof_count: 0 },
];
const PAYMENTS = [
  { id: 'p1', user_id: 'c2', status: 'processing', amount_xaf: 300000, amount_rmb: 1800, reference: 'BZ-PM-2001', method: 'alipay', created_at: NOW, proof_count: 0 },
];

const IGNORE = /websocket|realtime|Failed to load resource|favicon|ERR_|preload|font|net::|DevTools|chunk|status of [45]/i;

test.beforeEach(async ({ context }) => {
  await context.addInitScript(([k, v]) => window.localStorage.setItem(k as string, v as string), ['bonzini-admin-auth', JSON.stringify(SESSION)]);
  await context.route(/mock\.supabase\.co/, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const wantsObject = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    let body: unknown = [];
    if (path.includes('/auth/v1/user')) body = USER;
    else if (path.includes('/auth/v1/token')) body = SESSION;
    else if (path.includes('/auth/v1/')) body = {};
    else if (path.includes('/rest/v1/user_roles')) body = wantsObject ? ROLE : [ROLE_ROW];
    else if (path.includes('/rest/v1/clients')) body = CLIENTS;
    else if (path.includes('/rest/v1/deposits')) body = DEPOSITS;
    else if (path.includes('/rest/v1/payments')) body = PAYMENTS;
    else if (path.includes('/rest/v1/rpc/')) body = [];
    else body = wantsObject ? null : [];
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-2/3' }, body: JSON.stringify(body) });
  });
});

function watch(page: import('@playwright/test').Page) {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push('CRASH: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text().slice(0, 200)); });
  return errs;
}

test('interaction: global search dropdown', async ({ page }) => {
  const errs = watch(page);
  await page.goto('/m', { waitUntil: 'domcontentloaded' });
  await page.getByText('Console admin').first().waitFor({ timeout: 12_000 });
  await page.getByPlaceholder('Rechercher un client').fill('BZ');
  // "BZ-DP-1001" only appears in the search dropdown on this route.
  await page.getByText('BZ-DP-1001').waitFor({ timeout: 8_000 });
  await page.waitForTimeout(300);
  mkdirSync('qa-shots', { recursive: true });
  await page.screenshot({ path: 'qa-shots/x-search-dropdown.png' });
  await expect(page.getByText('BZ-PM-2001').first()).toBeVisible();
  await expect(page.getByText('Awa Traoré').first()).toBeVisible();
  expect.soft(errs, 'console during search').toEqual([]);
});

test('interaction: notifications dropdown', async ({ page }) => {
  const errs = watch(page);
  await page.goto('/m', { waitUntil: 'domcontentloaded' });
  await page.getByText('Console admin').first().waitFor({ timeout: 12_000 });
  await page.getByRole('button', { name: 'Notifications' }).click();
  await page.getByText('Voir tout').waitFor({ timeout: 8_000 });
  await page.waitForTimeout(400);
  mkdirSync('qa-shots', { recursive: true });
  await page.screenshot({ path: 'qa-shots/x-notifications-dropdown.png' });
  expect.soft(errs, 'console during notifications').toEqual([]);
});

test('interaction: deposits table populated', async ({ page }) => {
  const errs = watch(page);
  await page.goto('/m/deposits', { waitUntil: 'domcontentloaded' });
  await page.getByText('Console admin').first().waitFor({ timeout: 12_000 });
  await page.getByText('BZ-DP-1001').first().waitFor({ timeout: 8_000 });
  await page.waitForTimeout(400);
  mkdirSync('qa-shots', { recursive: true });
  await page.screenshot({ path: 'qa-shots/x-deposits-populated.png', fullPage: true });
  await expect(page.getByText('Awa Traoré').first()).toBeVisible();
  expect.soft(errs, 'console on deposits list').toEqual([]);
});

/**
 * Desktop admin QA — DARK MODE visual sweep.
 *
 * Same faked super_admin + Supabase interception as desktop-qa.spec.ts, but
 * forces the app into dark mode (next-themes `theme=dark` + emulated
 * prefers-color-scheme) and screenshots the main archetypes so dark-mode-only
 * breaks (light-only bg/text, missing dark: variants) are caught visually.
 * Screenshots → qa-shots/dark-*.png.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const USER = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'qa@bonzini.test', app_metadata: {}, user_metadata: {}, created_at: '2020-01-01T00:00:00Z' };
const SESSION = { access_token: 'fake', refresh_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: 4070908800, user: USER };
const ROLE = { role: 'super_admin', first_name: 'QA', last_name: 'Bot', avatar_url: null, is_disabled: false };
const ROLE_ROW = { id: 'role-1', user_id: USER.id, first_name: 'QA', last_name: 'Bot', role: 'super_admin', is_disabled: false };

const DARK_ROUTES: [string, string][] = [
  ['dark-dashboard', '/m'],
  ['dark-deposits', '/m/deposits'],
  ['dark-support', '/m/support'],
  ['dark-treasury-dashboard', '/m/more/treasury/dashboard'],
  ['dark-assistant', '/m/assistant'],
  ['dark-more-hub', '/m/more'],
  ['dark-rates', '/m/more/rates'],
  ['dark-deposit-new', '/m/deposits/new'],
];

test.use({ colorScheme: 'dark' });

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([key, val]) => {
      window.localStorage.setItem('bonzini-admin-auth', val as string);
      window.localStorage.setItem('theme', 'dark'); // next-themes default storage key
    },
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
    else if (path.includes('/rest/v1/rpc/')) body = [];
    else body = wantsObject ? null : [];
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: JSON.stringify(body) });
  });
});

for (const [name, path] of DARK_ROUTES) {
  test(name, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.getByText('Console admin').first().waitFor({ state: 'visible', timeout: 12_000 }).catch(() => {});
    await page.waitForTimeout(700);
    // Sanity: the dark class is actually applied to <html>.
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    mkdirSync('qa-shots', { recursive: true });
    await page.screenshot({ path: `qa-shots/${name}.png`, fullPage: true }).catch(() => {});
    expect.soft(isDark, `dark class applied on ${path}`).toBe(true);
  });
}

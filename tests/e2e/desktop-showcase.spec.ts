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
import { installConsole, type Scenario } from './fixtures/consoleHarness';

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

const install = (theme: 'light' | 'dark', scenario: Scenario = {}) => installConsole(theme, scenario);

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

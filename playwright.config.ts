import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for iOS form-input visual regression tests.
 *
 * Focus: prevent the iOS Safari auto-zoom bug from creeping back in.
 * The suite emulates iPhone + WebKit (same engine as mobile Safari),
 * opens every screen that hosts form controls, and asserts that each
 * input/textarea/select has `computedStyle.fontSize >= 16px`.
 *
 * Run locally:
 *   npx playwright install webkit --with-deps
 *   npm run test:e2e
 *
 * Run in CI (GitHub Actions with ubuntu-latest supports it out of the box).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'iPhone 14 (WebKit)',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'iPad Pro 11 (WebKit)',
      use: { ...devices['iPad Pro 11'] },
    },
  ],

  webServer: {
    command: 'npx vite --host --port 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Dimensional assertions for the desktop console.
 *
 * Separate from the capture config so it can be run in CI as a gate: a fourth
 * control height or an eighteenth font size fails the build instead of being
 * discovered in a screenshot review three weeks later.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /desktop-metrology\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  outputDir: './qa-shots/_metrology',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    viewport: { width: 1600, height: 1000 },
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
    ...(process.env.PW_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
      : {}),
  },
  webServer: {
    command: 'npx vite --host --port 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

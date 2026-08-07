import { defineConfig, devices } from '@playwright/test';

/**
 * Desktop console design captures (chromium @ 1600×1000).
 *
 * Separate from the QA sweep: this one runs the app against rich fixtures and
 * writes reviewable screenshots to docs/desktop-mockups/v2. Set
 * `PW_CHROMIUM_PATH` to reuse a Chromium already on the machine.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /desktop-showcase\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  outputDir: './docs/desktop-mockups/v2/_artifacts',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    viewport: { width: 1600, height: 1000 },
    // The console is French-first; pin the locale so captures don't drift into
    // the English catalogue on an en-US CI runner.
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
    deviceScaleFactor: 2,
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

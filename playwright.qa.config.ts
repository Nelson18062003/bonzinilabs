import { defineConfig, devices } from '@playwright/test';

/**
 * Desktop admin QA sweep (chromium @ 1440px). Separate from the iOS font-size
 * e2e config. Drives every desktop admin route with a faked super_admin session
 * + intercepted Supabase, capturing crashes / console errors / screenshots.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /desktop-(qa|showcase).*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 45_000,
  outputDir: './qa-shots/_artifacts',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    viewport: { width: 1440, height: 900 },
    // Allow running against a Chromium that is already on the machine (CI images,
    // sandboxes) instead of Playwright's own download cache.
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

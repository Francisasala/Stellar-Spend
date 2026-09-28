import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: 'e2e/fixtures/visual-regression/{testFileName}/{arg}{-projectName}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['WebKit'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});

/**
 * Cross-browser E2E matrix (Issue #1016):
 * Runs on chromium, firefox, and webkit instead of the previous
 * chromium + mobile-chrome + mobile-safari configuration.
 *
 * Runtime impact: total suite runtime increases by ~3x since the same
 * test suite now executes across 3 browser engines. Individual browser
 * runs can be executed with:
 *   npx playwright test --project=chromium
 *   npx playwright test --project=firefox
 *   npx playwright test --project=webkit
 *
 * Browser-specific failures: some e2e tests use features that behave
 * differently across browsers (e.g. waitForNavigation, screenshot
 * comparisons). Those tests have been updated to handle cross-browser
 * differences. See the e2e/ directory for browser-specific fixes.
 */
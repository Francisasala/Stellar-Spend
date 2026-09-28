import { test, expect } from '@playwright/test';

/**
 * Visual regression coverage for the 5 critical dashboard screens.
 * Baselines live under e2e/fixtures/visual-regression (see playwright.config.ts
 * `snapshotPathTemplate`). See e2e/fixtures/VISUAL_REGRESSION.md for how to
 * review and intentionally update a baseline.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).freighter = {
      isConnected: async () => true,
      getPublicKey: async () => 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      signTransaction: async (xdr: string) => xdr,
    };
  });
});

test.describe('Critical dashboard screens', () => {
  test('1. dashboard home - pre-connect state', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('01-dashboard-pre-connect.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('2. dashboard home - wallet connected state', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    if (await connectButton.isVisible()) {
      await connectButton.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot('02-dashboard-connected.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('3. transaction history screen', async ({ page }) => {
    await page.goto(`${BASE_URL}/history`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('03-transaction-history.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('4. settings screen', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('04-settings.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });

  test('5. status screen', async ({ page }) => {
    await page.goto(`${BASE_URL}/status`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('05-status.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });
  });
});

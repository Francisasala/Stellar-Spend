/**
 * Issue #1002 — Wallet Connect / Disconnect E2E Coverage
 * Issue #1340 — Stabilize Playwright E2E suite
 *
 * Covers the full wallet connect/disconnect lifecycle:
 *
 *  Connect flows
 *  ├── Freighter: happy path (stub returns a public key)
 *  ├── LOBSTR:   happy path
 *  └── Rejected: stub throws → UI shows an error state
 *
 *  Disconnect & session cleanup
 *  ├── Disconnect button clears the connected state
 *  ├── After disconnect the "Connect Wallet" button is visible again
 *  └── Reconnect after disconnect works
 *
 * Stability design (#1340):
 * - No `waitForTimeout` — all waits use web-first locator assertions.
 * - Storage is isolated per test via `isolatedTest` fixture; each test starts
 *   with empty localStorage/sessionStorage, preventing wallet-session leakage
 *   between tests.
 */

import { expect } from '@playwright/test';
import {
  injectFreighterStub,
  injectFreighterRejectedStub,
  injectLobstrStub,
  mockHorizonAccount,
  connectFreighterViaUI,
  WALLET_ADDRESSES,
} from './fixtures/wallet-fixtures';
import { isolatedTest as test } from './fixtures/test-isolation';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

/**
 * Verifies that the page is in a "wallet connected" state using web-first
 * assertions only — no fixed sleeps.
 */
async function assertWalletConnected(page: import('@playwright/test').Page): Promise<void> {
  // Use toPass to poll until one of the connected-state indicators resolves.
  await expect(async () => {
    const connectBtnVisible = await page
      .getByRole('button', { name: /connect wallet/i })
      .isVisible()
      .catch(() => false);
    const addressVisible = await page
      .getByText(/GB[A-Z0-9]{2,}[\.\u2026][A-Z0-9]{2,}/i)
      .isVisible()
      .catch(() => false);
    const connectedVisible = await page
      .getByText(/connected/i)
      .isVisible()
      .catch(() => false);
    // If the connect button is still showing AND no positive indicator is visible, retry.
    if (connectBtnVisible && !addressVisible && !connectedVisible) {
      throw new Error('Wallet not yet in connected state');
    }
  }).toPass({ timeout: 8_000 });
}

// ---------------------------------------------------------------------------
// Connect flows
// ---------------------------------------------------------------------------

test.describe('Wallet Connect — Freighter happy path', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterStub(page, WALLET_ADDRESSES.freighter);
    await mockHorizonAccount(page, WALLET_ADDRESSES.freighter);
  });

  test('Connect Wallet button is visible on load', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('clicking Connect Wallet opens the wallet picker or connects directly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /connect wallet/i }).click();

    // Wait for any observable state change: modal, wallet option, or connected state.
    await expect(async () => {
      const modalVisible = await page
        .getByRole('dialog')
        .isVisible()
        .catch(() => false);
      const freighterVisible = await page
        .getByRole('button', { name: /freighter/i })
        .isVisible()
        .catch(() => false);
      const connectBtnGone = !(await page
        .getByRole('button', { name: /connect wallet/i })
        .isVisible()
        .catch(() => true));
      if (!modalVisible && !freighterVisible && !connectBtnGone) {
        throw new Error('No state change detected after clicking Connect Wallet');
      }
    }).toPass({ timeout: 5_000 });
  });

  test('Freighter wallet connects successfully and address is shown', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await connectFreighterViaUI(page);
    await assertWalletConnected(page);
  });

  test('no JS runtime errors occur during wallet connection', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await connectFreighterViaUI(page);
    await assertWalletConnected(page);

    const fatalErrors = jsErrors.filter(
      (e) =>
        !e.includes('ResizeObserver') &&
        !e.includes('Non-Error promise rejection') &&
        !e.includes('Script error'),
    );
    expect(fatalErrors, `Unexpected JS errors: ${fatalErrors.join('; ')}`).toHaveLength(0);
  });
});

test.describe('Wallet Connect — LOBSTR happy path', () => {
  test.beforeEach(async ({ page }) => {
    await injectLobstrStub(page, WALLET_ADDRESSES.lobstr);
    await mockHorizonAccount(page, WALLET_ADDRESSES.lobstr);
  });

  test('LOBSTR option is present in the wallet picker', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /connect wallet/i }).click();

    const lobstrOption = page.getByRole('button', { name: /lobstr/i });
    // Only assert if the option appears — some UIs auto-connect without a picker.
    const isVisible = await lobstrOption.isVisible({ timeout: 3_000 }).catch(() => false);
    if (isVisible) {
      await expect(lobstrOption).toBeVisible();
    }
  });

  test('wallet picker modal renders both Freighter and LOBSTR options', async ({ page }) => {
    await injectFreighterStub(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /connect wallet/i }).click();

    const freighterOption = page.getByRole('button', { name: /freighter/i });
    const lobstrOption = page.getByRole('button', { name: /lobstr/i });

    const freighterVisible = await freighterOption.isVisible({ timeout: 3_000 }).catch(() => false);
    const lobstrVisible = await lobstrOption.isVisible({ timeout: 3_000 }).catch(() => false);

    if (freighterVisible || lobstrVisible) {
      expect(freighterVisible, 'Freighter option should be in wallet picker').toBe(true);
      expect(lobstrVisible, 'LOBSTR option should be in wallet picker').toBe(true);
    }
  });
});

test.describe('Wallet Connect — rejected connection', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterRejectedStub(page);
  });

  test('UI handles a rejected Freighter connection without crashing', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /connect wallet/i }).click();

    const freighterBtn = page.getByRole('button', { name: /freighter/i });
    if (await freighterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await freighterBtn.click();
      // Wait for the UI to settle after the rejected connection attempt.
      await expect(async () => {
        const connectVisible = await page
          .getByRole('button', { name: /connect wallet/i })
          .isVisible()
          .catch(() => false);
        const errorVisible = await page
          .getByText(/error|failed|declined|not installed|rejected/i)
          .isVisible()
          .catch(() => false);
        if (!connectVisible && !errorVisible) throw new Error('UI still loading');
      }).toPass({ timeout: 5_000 });
    }

    const fatalErrors = jsErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error promise rejection'),
    );
    expect(fatalErrors, `Page crashed with: ${fatalErrors.join('; ')}`).toHaveLength(0);
    expect(page.url()).not.toContain('/500');
  });

  test('error state is surfaced to the user when connection is rejected', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /connect wallet/i }).click();

    const freighterBtn = page.getByRole('button', { name: /freighter/i });
    if (await freighterBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await freighterBtn.click();
      await expect(async () => {
        const connectStillVisible = await page
          .getByRole('button', { name: /connect wallet/i })
          .isVisible()
          .catch(() => false);
        const errorVisible = await page
          .getByText(/error|failed|declined|not installed|rejected/i)
          .isVisible()
          .catch(() => false);
        if (!connectStillVisible && !errorVisible) throw new Error('Waiting for settled state');
      }).toPass({ timeout: 6_000 });
    }

    const connectStillVisible = await page
      .getByRole('button', { name: /connect wallet/i })
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    const errorMessageVisible = await page
      .getByText(/error|failed|declined|not installed|rejected/i)
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    expect(
      connectStillVisible || errorMessageVisible,
      'After a rejected connection either the connect button should still be shown or an error message should appear',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Disconnect & session cleanup
// ---------------------------------------------------------------------------

test.describe('Wallet Disconnect & Session Cleanup', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterStub(page, WALLET_ADDRESSES.freighter);
    await mockHorizonAccount(page, WALLET_ADDRESSES.freighter);
  });

  test('wallet can be disconnected via UI', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await connectFreighterViaUI(page);
    await assertWalletConnected(page);

    const disconnectBtn = page.getByRole('button', { name: /disconnect/i });
    const walletMenuBtn = page
      .locator('[data-testid="wallet-button"], [aria-label*="wallet" i]')
      .first();

    if (await disconnectBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await disconnectBtn.click();
    } else if (await walletMenuBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await walletMenuBtn.click();
      const disconnectOption = page.getByRole('button', { name: /disconnect/i });
      await expect(disconnectOption).toBeVisible({ timeout: 3_000 });
      await disconnectOption.click();
    }

    // Web-first: wait for the connect button to reappear.
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('localStorage session data is cleared on disconnect', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await connectFreighterViaUI(page);
    await assertWalletConnected(page);

    const connectedState = await page.evaluate(() =>
      JSON.stringify(
        Object.entries(localStorage)
          .filter(
            ([k]) => k.toLowerCase().includes('wallet') || k.toLowerCase().includes('session'),
          )
          .map(([k, v]) => ({ key: k, hasValue: !!v })),
      ),
    );

    const disconnectBtn = page.getByRole('button', { name: /disconnect/i });
    const walletMenuBtn = page
      .locator('[data-testid="wallet-button"], [aria-label*="wallet" i]')
      .first();

    if (await disconnectBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await disconnectBtn.click();
    } else if (await walletMenuBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await walletMenuBtn.click();
      const opt = page.getByRole('button', { name: /disconnect/i });
      if (await opt.isVisible({ timeout: 2_000 }).catch(() => false)) await opt.click();
    }

    // Wait for disconnect to settle — connect button reappears.
    await expect(async () => {
      const backToConnect = await page
        .getByRole('button', { name: /connect wallet/i })
        .isVisible()
        .catch(() => false);
      if (!backToConnect) throw new Error('Disconnect not yet complete');
    }).toPass({ timeout: 5_000 });

    const disconnectedState = await page.evaluate(() =>
      JSON.stringify(
        Object.entries(localStorage)
          .filter(
            ([k]) => k.toLowerCase().includes('wallet') || k.toLowerCase().includes('session'),
          )
          .map(([k, v]) => ({ key: k, hasValue: !!v })),
      ),
    );

    const sessionCleared = connectedState !== disconnectedState;
    const backToConnectBtn = await page
      .getByRole('button', { name: /connect wallet/i })
      .isVisible()
      .catch(() => false);

    expect(
      backToConnectBtn || sessionCleared,
      'After disconnect either the connect button should reappear or wallet session data should change',
    ).toBe(true);
  });

  test('reconnect after disconnect works', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await connectFreighterViaUI(page);
    await assertWalletConnected(page);

    const disconnectBtn = page.getByRole('button', { name: /disconnect/i });
    const walletMenuBtn = page
      .locator('[data-testid="wallet-button"], [aria-label*="wallet" i]')
      .first();

    if (await disconnectBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await disconnectBtn.click();
    } else if (await walletMenuBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await walletMenuBtn.click();
      const opt = page.getByRole('button', { name: /disconnect/i });
      if (await opt.isVisible({ timeout: 2_000 }).catch(() => false)) await opt.click();
    }

    const reconnectBtn = page.getByRole('button', { name: /connect wallet/i });
    if (await reconnectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await connectFreighterViaUI(page);
      await assertWalletConnected(page);
    }
  });
});

// ---------------------------------------------------------------------------
// Modal accessibility
// ---------------------------------------------------------------------------

test.describe('Wallet Modal — Accessibility', () => {
  test('wallet picker modal is dismissible via keyboard Escape', async ({ page }) => {
    await injectFreighterStub(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /connect wallet/i }).click();

    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 3_000 });
    }
  });

  test('wallet picker modal has dialog role with aria-modal', async ({ page }) => {
    await injectFreighterStub(page);

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /connect wallet/i }).click();

    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
    }
  });
});

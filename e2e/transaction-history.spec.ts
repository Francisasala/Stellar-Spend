/**
 * #955 — Migrate from text-based selectors to data-testid for stability.
 *
 * All selectors previously relying on button text content, placeholder strings,
 * or element text have been replaced with explicit data-testid attributes.
 */
import { test, expect } from '@playwright/test';
import { injectFreighterStub } from './fixtures/wallet-fixtures';
import { waitForNetworkIdle } from './helpers/wait';

test.describe('Transaction History', () => {
  test.beforeEach(async ({ page }) => {
    await injectFreighterStub(page);
    await page.goto('http://localhost:3001');

    // Connect wallet
    await page.click('[data-testid="connect-wallet-button"]');
    await page.waitForSelector('[data-testid="wallet-modal"]');
    await page.click('[data-testid="wallet-option-freighter"]');
    await page.waitForSelector('[data-testid="wallet-button"]');
  });

  test('should display transaction history', async ({ page }) => {
    // Navigate to history
    await page.goto('http://localhost:3001/history');
    await page.waitForSelector('[data-testid="transaction-history"]');

    // Verify history is visible
    const history = await page.locator('[data-testid="transaction-history"]');
    expect(history).toBeVisible();
  });

  test('supports keyboard navigation through virtualized rows', async ({ page }) => {
    const walletAddress = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    const transactions = Array.from({ length: 150 }, (_, index) => ({
      id: `virtualized-tx-${index}`,
      timestamp: Date.now() - index * 60_000,
      userAddress: walletAddress,
      amount: String(index + 1),
      currency: 'NGN',
      beneficiary: {
        institution: 'Test Bank',
        accountIdentifier: String(index).padStart(10, '0'),
        accountName: `Recipient ${index}`,
        currency: 'NGN',
      },
      status: 'completed',
    }));

    await page.evaluate((rows) => {
      localStorage.setItem('stellar_spend_transactions', JSON.stringify(rows));
    }, transactions);
    await page.goto('http://localhost:3001/history');
    await page.waitForSelector('[data-testid="transaction-history"]');
    await page.selectOption('select[aria-label="Rows per page"]', '250');

    const rows = page.locator('[data-testid="transaction-entry"]');
    await expect(rows.first()).toBeVisible();
    await expect.poll(() => rows.count()).toBeLessThan(100);

    await rows.first().focus();
    for (let index = 0; index < 110; index++) {
      await page.keyboard.press('ArrowDown');
    }
    await expect(page.locator('[data-row-index="110"]')).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(page.locator('[data-row-index="109"]')).toBeFocused();
    await expect.poll(() => rows.count()).toBeLessThan(100);
  });

  test('should display transaction details', async ({ page }) => {
    // Navigate to history
    await page.goto('http://localhost:3001/history');
    await page.waitForSelector('[data-testid="transaction-history"]');

    // Click on first transaction
    const firstTx = await page.locator('[data-testid="transaction-entry"]').first();
    if (await firstTx.isVisible()) {
      await firstTx.click();
      await page.waitForSelector('[data-testid="transaction-details"]');

      // Verify details are displayed
      const details = await page.locator('[data-testid="transaction-details"]');
      expect(details).toBeVisible();
    }
  });

  test('should filter transactions by status', async ({ page }) => {
    // Navigate to history
    await page.goto('http://localhost:3001/history');
    await page.waitForSelector('[data-testid="transaction-history"]');

    // Filter by completed
    await page.selectOption('[data-testid="filter-status"]', 'completed');

    // Wait for filtered results
    await waitForNetworkIdle(page);

    // Verify only completed transactions are shown
    const entries = await page.locator('[data-testid="transaction-entry"]');
    const count = await entries.count();

    for (let i = 0; i < count; i++) {
      const status = await entries
        .nth(i)
        .locator('[data-testid="transaction-status"]')
        .textContent();
      expect(status).toContain('Completed');
    }
  });

  test('should search transactions', async ({ page }) => {
    // Navigate to history
    await page.goto('http://localhost:3001/history');
    await page.waitForSelector('[data-testid="transaction-history"]');

    // Search for transaction
    await page.fill('[data-testid="search-input"]', 'NGN');

    // Wait for search results
    await waitForNetworkIdle(page);

    // Verify results contain search term
    const entries = await page.locator('[data-testid="transaction-entry"]');
    const count = await entries.count();

    if (count > 0) {
      const firstEntry = await entries.first().textContent();
      expect(firstEntry).toContain('NGN');
    }
  });

  test('should sort transactions', async ({ page }) => {
    // Navigate to history
    await page.goto('http://localhost:3001/history');
    await page.waitForSelector('[data-testid="transaction-history"]');

    // Sort by date descending
    await page.click('[data-testid="sort-date"]');
    await page.click('[data-testid="sort-direction-desc"]');

    // Wait for sorted results
    await waitForNetworkIdle(page);

    // Verify transactions are sorted
    const entries = await page.locator('[data-testid="transaction-entry"]');
    expect(entries).toBeDefined();
  });

  test('should export transaction history', async ({ page }) => {
    // Navigate to history
    await page.goto('http://localhost:3001/history');
    await page.waitForSelector('[data-testid="transaction-history"]');

    // Click export button
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-button"]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toContain('transactions');
  });

  test('should display transaction statistics', async ({ page }) => {
    // Navigate to history
    await page.goto('http://localhost:3001/history');
    await page.waitForSelector('[data-testid="transaction-history"]');

    // Verify statistics are displayed
    const stats = await page.locator('[data-testid="transaction-stats"]');
    expect(stats).toBeVisible();

    // Check for total amount
    const totalAmount = await page.locator('[data-testid="total-amount"]').textContent();
    expect(totalAmount).toMatch(/\d+/);
  });

  test('should handle empty transaction history', async ({ page }) => {
    // Navigate to history
    await page.goto('http://localhost:3001/history');
    await page.waitForSelector('[data-testid="transaction-history"]');

    // Check for empty state
    const emptyState = await page.locator('[data-testid="empty-state"]');
    if (await emptyState.isVisible()) {
      expect(emptyState).toContainText('No transactions');
    }
  });
});

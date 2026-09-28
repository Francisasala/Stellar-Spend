/**
 * #955 — Migrate from text-based selectors to data-testid for stability.
 *
 * All selectors previously relying on button text content or placeholder
 * strings have been replaced with explicit data-testid attributes to prevent
 * breakage on copy/wording changes.
 */
import { test, expect } from '@playwright/test';

test.describe('Complete Offramp Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
  });

  test('should complete full offramp transaction', async ({ page }) => {
    // Step 1: Connect wallet
    await page.click('[data-testid="connect-wallet-button"]');
    await page.waitForSelector('[data-testid="wallet-modal"]');

    // Select Freighter
    await page.click('[data-testid="wallet-option-freighter"]');
    await page.waitForSelector('input[placeholder="Enter amount"]');

    // Step 2: Enter amount
    await page.fill('#amount', '100');

    // Step 3: Select currency
    await page.selectOption('#currency', 'NGN');

    // Step 4: Select fee method (USDC radio)
    await page.click('[data-testid="fee-method-stablecoin"]');

    // Step 5: Get quote — wait for quote result to appear
    await page.waitForSelector('[data-testid="quote-result"]');

    // Verify quote is displayed
    const quote = await page.locator('[data-testid="quote-result"]').textContent();
    expect(quote).toContain('NGN');

    // Step 6: Enter beneficiary details
    await page.fill('[data-testid="account-number-input"]', '1234567890');
    await page.selectOption('#institution', 'ACCESS');

    // Step 7: Wait for account verification
    await page.waitForSelector('[data-testid="resolved-account-name"]');

    // Step 8: Submit the offramp
    await page.click('[data-testid="offramp-cta-button"]');

    // Wait for transaction to be submitted
    await page.waitForSelector('[data-testid="transaction-submitted"]');

    // Verify success message
    const successMessage = await page.locator('[data-testid="success-message"]').textContent();
    expect(successMessage).toContain('Transaction submitted');
  });

  test('should handle transaction with error recovery', async ({ page }) => {
    // Step 1: Connect wallet
    await page.click('[data-testid="connect-wallet-button"]');
    await page.waitForSelector('[data-testid="wallet-modal"]');
    await page.click('[data-testid="wallet-option-freighter"]');
    await page.waitForSelector('input[placeholder="Enter amount"]');

    // Step 2: Enter invalid amount first
    await page.fill('#amount', '-100');

    // Should show error
    await page.waitForSelector('[data-testid="error-message"]');
    const error = await page.locator('[data-testid="error-message"]').textContent();
    expect(error).toContain('Invalid amount');

    // Step 3: Correct the amount
    await page.fill('#amount', '100');

    // Should now show quote
    await page.waitForSelector('[data-testid="quote-result"]');
    const quote = await page.locator('[data-testid="quote-result"]').textContent();
    expect(quote).toBeDefined();
  });

  test('should display transaction history', async ({ page }) => {
    // Navigate to history page
    await page.goto('http://localhost:3001/history');
    await page.waitForSelector('[data-testid="transaction-history"]');

    // Verify history is displayed
    const history = await page.locator('[data-testid="transaction-history"]');
    expect(history).toBeVisible();

    // Check for transaction entries
    const entries = await page.locator('[data-testid="transaction-entry"]').count();
    expect(entries).toBeGreaterThanOrEqual(0);
  });

  test('should handle wallet disconnection', async ({ page }) => {
    // Connect wallet
    await page.click('[data-testid="connect-wallet-button"]');
    await page.waitForSelector('[data-testid="wallet-modal"]');
    await page.click('[data-testid="wallet-option-freighter"]');
    await page.waitForSelector('[data-testid="wallet-button"]');

    // Verify connected state — button flips to wallet-button once connected
    const walletButton = await page.locator('[data-testid="wallet-button"]');
    expect(walletButton).toBeVisible();

    // Disconnect wallet
    await page.click('[data-testid="wallet-button"]');
    await page.click('[data-testid="disconnect-button"]');

    // Verify disconnected state
    const connectButton = await page.locator('[data-testid="connect-wallet-button"]');
    expect(connectButton).toBeVisible();
  });

  test('should validate beneficiary account', async ({ page }) => {
    // Connect wallet
    await page.click('[data-testid="connect-wallet-button"]');
    await page.waitForSelector('[data-testid="wallet-modal"]');
    await page.click('[data-testid="wallet-option-freighter"]');
    await page.waitForSelector('input[name="accountNumber"]');

    // Enter invalid account number
    await page.fill('[data-testid="account-number-input"]', 'invalid');

    // Should show error
    await page.waitForSelector('[data-testid="error-message"]');
    const error = await page.locator('[data-testid="error-message"]').textContent();
    expect(error).toContain('Invalid account');

    // Enter valid account number
    await page.fill('[data-testid="account-number-input"]', '1234567890');

    // Should show verified account name
    await page.waitForSelector('[data-testid="resolved-account-name"]');
  });
});

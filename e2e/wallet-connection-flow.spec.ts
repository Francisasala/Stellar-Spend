import { test, expect } from '@playwright/test';

test.describe('Wallet Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
  });

  test('should connect with Freighter wallet', async ({ page }) => {
    // Click connect button
    await page.click('button:has-text("Connect Wallet")');
    await page.waitForSelector('[data-testid="wallet-modal"]');

    // Select Freighter
    await page.click('button:has-text("Freighter")');

    // Verify connected state (auto-waiting assertion; waitForNavigation is
    // unreliable across Firefox/WebKit for SPA route changes)
    const walletButton = await page.locator('[data-testid="wallet-button"]');
    await expect(walletButton).toContainText('Connected');
  });

  test('should connect with Lobstr wallet', async ({ page }) => {
    // Click connect button
    await page.click('button:has-text("Connect Wallet")');
    await page.waitForSelector('[data-testid="wallet-modal"]');

    // Select Lobstr
    await page.click('button:has-text("Lobstr")');

    // Verify connected state
    const walletButton = await page.locator('[data-testid="wallet-button"]');
    await expect(walletButton).toContainText('Connected');
  });

  test('should auto-detect wallet', async ({ page }) => {
    // Click connect button
    await page.click('button:has-text("Connect Wallet")');
    await page.waitForSelector('[data-testid="wallet-modal"]');

    // Should show auto-detect option
    const autoDetect = await page.locator('button:has-text("Auto-detect")');
    expect(autoDetect).toBeVisible();

    // Click auto-detect
    await page.click('button:has-text("Auto-detect")');

    // Should connect to available wallet
    const walletButton = await page.locator('[data-testid="wallet-button"]');
    await expect(walletButton).toContainText('Connected');
  });

  test('should display wallet address', async ({ page }) => {
    // Connect wallet
    await page.click('button:has-text("Connect Wallet")');
    await page.waitForSelector('[data-testid="wallet-modal"]');
    await page.click('button:has-text("Freighter")');

    // Click wallet button to show details
    await page.click('[data-testid="wallet-button"]');
    await page.waitForSelector('[data-testid="wallet-details"]');

    // Verify address is displayed
    const address = await page.locator('[data-testid="wallet-address"]').textContent();
    expect(address).toMatch(/^G[A-Z0-9]{55}$/); // Stellar address format
  });

  test('should display wallet balance', async ({ page }) => {
    // Connect wallet
    await page.click('button:has-text("Connect Wallet")');
    await page.waitForSelector('[data-testid="wallet-modal"]');
    await page.click('button:has-text("Freighter")');

    // Click wallet button to show details
    await page.click('[data-testid="wallet-button"]');
    await page.waitForSelector('[data-testid="wallet-details"]');

    // Verify balance is displayed
    const balance = await page.locator('[data-testid="wallet-balance"]').textContent();
    expect(balance).toMatch(/\d+(\.\d+)?/); // Should be a number
  });

  test('should handle wallet connection error', async ({ page }) => {
    // Click connect button
    await page.click('button:has-text("Connect Wallet")');
    await page.waitForSelector('[data-testid="wallet-modal"]');

    // Try to connect with unavailable wallet
    const unavailableButton = await page.locator('button:has-text("Unavailable")').first();
    if (await unavailableButton.isVisible()) {
      await unavailableButton.click();

      // Should show error message
      const error = await page.locator('[data-testid="error-message"]').textContent();
      expect(error).toContain('not installed');
    }
  });

  test('should allow wallet switching', async ({ page }) => {
    // Connect with first wallet
    await page.click('button:has-text("Connect Wallet")');
    await page.waitForSelector('[data-testid="wallet-modal"]');
    await page.click('button:has-text("Freighter")');

    // Verify connected
    let walletButton = await page.locator('[data-testid="wallet-button"]');
    await expect(walletButton).toContainText('Connected');

    // Disconnect
    await page.click('[data-testid="wallet-button"]');
    await page.click('button:has-text("Disconnect")');

    // Connect with different wallet
    await page.click('button:has-text("Connect Wallet")');
    await page.waitForSelector('[data-testid="wallet-modal"]');
    await page.click('button:has-text("Lobstr")');

    // Verify connected with new wallet
    walletButton = await page.locator('[data-testid="wallet-button"]');
    await expect(walletButton).toContainText('Connected');
  });
});

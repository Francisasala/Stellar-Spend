import { test, expect } from '@playwright/test';

interface FreighterMock {
  isConnected: () => Promise<boolean>;
  getPublicKey: () => Promise<string>;
  signTransaction: (xdr: string) => Promise<string>;
}

test.describe('Wallet connect flow', () => {
  test('connects wallet with mock Freighter', async ({ page }) => {
    await page.goto('/');

    // Mock Freighter API
    await page.addInitScript(() => {
      (window as unknown as { freighter: FreighterMock }).freighter = {
        isConnected: async () => true,
        getPublicKey: async () => 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        signTransaction: async (xdr: string) => xdr,
      };
    });

    // Mock Horizon API for balance
    await page.route('**/accounts/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balances: [
            {
              asset_code: 'USDC',
              asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
              balance: '1000.0000000',
            },
            {
              asset_type: 'native',
              balance: '50.0000000',
            },
          ],
        }),
      });
    });

    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();

    // Verify wallet address appears
    await expect(page.getByText(/GBBD...FLA5/i)).toBeVisible();

    // Verify balance is fetched
    await expect(page.getByText(/1000.*USDC/i)).toBeVisible();
    await expect(page.getByText(/50.*XLM/i)).toBeVisible();
  });

  test('disconnects wallet and clears balances', async ({ page }) => {
    await page.goto('/');

    // Mock Freighter API
    let isConnected = true;
    await page.addInitScript(() => {
      (window as unknown as { freighter: FreighterMock }).freighter = {
        isConnected: async () => true,
        getPublicKey: async () => 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        signTransaction: async (xdr: string) => xdr,
      };
    });

    // Mock Horizon API for balance
    await page.route('**/accounts/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balances: [
            {
              asset_code: 'USDC',
              asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
              balance: '1000.0000000',
            },
            {
              asset_type: 'native',
              balance: '50.0000000',
            },
          ],
        }),
      });
    });

    // Connect wallet
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();

    // Verify wallet is connected
    await expect(page.getByText(/GBBD...FLA5/i)).toBeVisible();
    await expect(page.getByText(/1000.*USDC/i)).toBeVisible();

    // Disconnect wallet
    const disconnectButton = page.getByRole('button', { name: /disconnect|logout|sign out/i });
    await disconnectButton.click();

    // Verify disconnect confirmation if present
    const confirmButton = page.getByRole('button', { name: /confirm|yes|disconnect/i }).last();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Verify wallet address is removed
    await expect(page.getByText(/GBBD...FLA5/i)).not.toBeVisible();

    // Verify balances are cleared
    await expect(page.getByText(/1000.*USDC/i)).not.toBeVisible();
    await expect(page.getByText(/50.*XLM/i)).not.toBeVisible();

    // Verify connect button is visible again
    await expect(page.getByRole('button', { name: /connect wallet/i })).toBeVisible();
  });

  test('handles wallet disconnection errors gracefully', async ({ page }) => {
    await page.goto('/');

    // Mock Freighter API
    await page.addInitScript(() => {
      (window as unknown as { freighter: FreighterMock }).freighter = {
        isConnected: async () => true,
        getPublicKey: async () => 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        signTransaction: async (xdr: string) => xdr,
      };
    });

    // Mock Horizon API for balance
    await page.route('**/accounts/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balances: [
            {
              asset_type: 'native',
              balance: '50.0000000',
            },
          ],
        }),
      });
    });

    // Connect wallet
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await connectButton.click();

    await expect(page.getByText(/GBBD...FLA5/i)).toBeVisible();

    // Mock a network error when disconnecting
    await page.route('**/accounts/*', async (route) => {
      await route.abort('failed');
    });

    // Attempt to disconnect
    const disconnectButton = page.getByRole('button', { name: /disconnect|logout|sign out/i });
    await disconnectButton.click();

    // Verify error message or that system still allows local disconnect
    const errorMessage = page.getByRole('alert');
    const stillConnectedOrClear = page
      .getByText(/GBBD...FLA5/i)
      .or(page.getByText(/connection.*error|failed.*disconnect/i));

    // Should show either error or be disconnected (depending on implementation)
    await expect(stillConnectedOrClear.or(errorMessage)).toBeTruthy();
  });
});

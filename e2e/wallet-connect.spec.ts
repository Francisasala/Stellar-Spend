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
});

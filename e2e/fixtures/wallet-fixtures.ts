/**
 * Wallet E2E fixtures — Issues #1002 & #1003
 *
 * Provides deterministic mock wallet stubs and API route responses for
 * Playwright tests covering the wallet connect / disconnect lifecycle and
 * the full send-payment happy path.
 *
 * All wallet addresses and responses are fake test-only values.
 * No production secrets or live network calls are made.
 */

import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Wallet identities
// ---------------------------------------------------------------------------

export const WALLET_ADDRESSES = {
  /** Primary test wallet — Freighter */
  freighter: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  /** Secondary test wallet — LOBSTR */
  lobstr: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZQ6O9CXJVKF7YIODIXQR',
} as const;

export type WalletName = 'freighter' | 'lobstr';

// ---------------------------------------------------------------------------
// Browser-side wallet stubs (injected via addInitScript)
// ---------------------------------------------------------------------------

/**
 * Injects a working Freighter wallet stub into the browser page.
 * The stub auto-approves all signing requests.
 */
export async function injectFreighterStub(
  page: Page,
  address: string = WALLET_ADDRESSES.freighter,
): Promise<void> {
  await page.addInitScript((addr: string) => {
    // Freighter legacy API shape
    (window as Record<string, unknown>).freighter = {
      isConnected: async () => true,
      getPublicKey: async () => addr,
      getNetwork: async () => 'PUBLIC',
      getNetworkDetails: async () => ({
        network: 'PUBLIC',
        networkPassphrase: 'Public Global Stellar Network ; September 2015',
      }),
      signTransaction: async (xdr: string) => xdr, // auto-approve
    };
    // Freighter newer API shape (some app versions use this)
    (window as Record<string, unknown>).freighterApi = {
      isConnected: async () => ({ isConnected: true }),
      getPublicKey: async () => ({ publicKey: addr }),
      signTransaction: async (xdr: string) => ({ signedTransaction: xdr }),
    };
  }, address);
}

/**
 * Injects a Freighter stub that rejects the connection request.
 * Used for testing the "connection rejected" error path.
 */
export async function injectFreighterRejectedStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as Record<string, unknown>).freighter = {
      isConnected: async () => false,
      getPublicKey: async () => {
        throw new Error('User declined access');
      },
      getNetwork: async () => 'PUBLIC',
      getNetworkDetails: async () => ({ network: 'PUBLIC', networkPassphrase: '' }),
      signTransaction: async () => {
        throw new Error('User rejected signing');
      },
    };
  });
}

/**
 * Injects a LOBSTR wallet stub into the browser page.
 */
export async function injectLobstrStub(
  page: Page,
  address: string = WALLET_ADDRESSES.lobstr,
): Promise<void> {
  await page.addInitScript((addr: string) => {
    // LOBSTR uses a similar shape to Freighter but under a different key
    (window as Record<string, unknown>).lobstr = {
      isConnected: async () => true,
      getPublicKey: async () => addr,
      signTransaction: async (xdr: string) => xdr,
    };
  }, address);
}

// ---------------------------------------------------------------------------
// Horizon / API network mocks
// ---------------------------------------------------------------------------

/**
 * Mocks the Stellar Horizon account endpoint so balance fetches succeed.
 */
export async function mockHorizonAccount(
  page: Page,
  address: string = WALLET_ADDRESSES.freighter,
  usdcBalance = '1000.0000000',
  xlmBalance = '50.0000000',
): Promise<void> {
  await page.route(`**/accounts/${address}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: address,
        account_id: address,
        balances: [
          {
            asset_code: 'USDC',
            asset_issuer: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB6HP',
            balance: usdcBalance,
          },
          {
            asset_type: 'native',
            balance: xlmBalance,
          },
        ],
      }),
    }),
  );

  // Also match the wildcard form used by some Horizon clients
  await page.route('**/accounts/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        balances: [
          {
            asset_code: 'USDC',
            asset_issuer: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB6HP',
            balance: usdcBalance,
          },
          { asset_type: 'native', balance: xlmBalance },
        ],
      }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Offramp API mocks (used in send-payment tests)
// ---------------------------------------------------------------------------

export const MOCK_PAYMENT = {
  amount: '100',
  currency: 'NGN',
  feeMethod: 'USDC',
  recipient: {
    institution: 'ACCESS',
    accountIdentifier: '0123456789',
    accountName: 'Jane Doe',
  },
} as const;

export const MOCK_QUOTE = {
  destinationAmount: '158200.00',
  rate: 1582,
  currency: 'NGN',
  bridgeFee: '0.50',
  payoutFee: '0',
  estimatedTime: 300,
  expiresIn: 300,
} as const;

export const MOCK_BUILD_TX = {
  xdr: 'AAAAAgAAAABBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5...',
  sourceToken: { symbol: 'USDC', decimals: 7, chain: 'STELLAR' },
  destinationToken: { symbol: 'USDC', decimals: 6, chain: 'BASE' },
} as const;

export const MOCK_SUBMIT_RESULT = {
  txHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  status: 'submitted',
} as const;

export const MOCK_PAYOUT_ORDER = {
  orderId: 'pay_test_order_001',
  status: 'pending',
  receiveAddress: '0xpaycrest_deposit_addr_test',
} as const;

/**
 * Registers mock handlers for all offramp API routes used in the payment flow.
 * All responses are deterministic and match the OpenAPI spec shapes.
 */
export async function mockOfframpApis(page: Page): Promise<void> {
  await page.route('**/api/health**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
    }),
  );

  await page.route('**/api/offramp/currencies**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
          { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
        ],
      }),
    }),
  );

  await page.route('**/api/offramp/rate**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rate: 1582, currency: 'NGN' }),
    }),
  );

  await page.route('**/api/offramp/quote**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_QUOTE),
    }),
  );

  await page.route('**/api/offramp/verify-account**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accountName: MOCK_PAYMENT.recipient.accountName }),
    }),
  );

  await page.route('**/api/offramp/bridge/gas-fee-options**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        feeOptions: {
          stablecoin: { int: '500000', float: '0.50' },
          native: { int: '1000000', float: '1.00' },
        },
      }),
    }),
  );

  await page.route('**/api/offramp/institutions/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { code: 'ACCESS', name: 'Access Bank' },
        { code: 'GTB', name: 'GTBank' },
      ]),
    }),
  );

  await page.route('**/api/offramp/bridge/build-tx**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BUILD_TX),
    }),
  );

  await page.route('**/api/offramp/bridge/submit-soroban**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SUBMIT_RESULT),
    }),
  );

  await page.route('**/api/offramp/bridge/status/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'completed', receiveAmount: '99.5' }),
    }),
  );

  await page.route('**/api/offramp/bridge/tx-status/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'SUCCESS', hash: MOCK_SUBMIT_RESULT.txHash }),
    }),
  );

  await page.route('**/api/offramp/paycrest/order**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PAYOUT_ORDER),
    }),
  );

  await page.route('**/api/offramp/execute-payout**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    }),
  );

  await page.route('**/api/offramp/status/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'settled', orderId: MOCK_PAYOUT_ORDER.orderId }),
    }),
  );
}

// ---------------------------------------------------------------------------
// UI interaction helpers
// ---------------------------------------------------------------------------

/**
 * Clicks "Connect Wallet" and selects the Freighter option from the modal.
 * Tolerates both modal-based and direct-connect flows.
 */
export async function connectFreighterViaUI(page: Page): Promise<void> {
  const connectBtn = page.getByRole('button', { name: /connect wallet/i });
  await connectBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await connectBtn.click();

  // Small wait for modal animation
  await page.waitForTimeout(300);

  // Select Freighter from the wallet picker (if a modal appears)
  const freighterBtn = page.getByRole('button', { name: /freighter/i });
  if (await freighterBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await freighterBtn.click();
    await page.waitForTimeout(400);
  }
}

/**
 * Seeds localStorage with one pre-existing settled transaction so that
 * history page tests have something to assert against.
 */
export async function seedTransactionHistory(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const tx = {
      id: 'seed_tx_wallet_fixture_001',
      amount: '50',
      currency: 'NGN',
      destinationAmount: '79100.00',
      status: 'settled',
      txHash: 'seed000000000000000000000000000000000000000000000000000000000001',
      createdAt: new Date(Date.now() - 86_400_000).toISOString(),
      recipient: {
        institution: 'GTB',
        accountIdentifier: '9876543210',
        accountName: 'John Recipient',
      },
    };
    localStorage.setItem('stellar_spend_transactions', JSON.stringify([tx]));
  });
}

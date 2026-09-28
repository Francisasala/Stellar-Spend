/**
 * stellar-mock-service.ts
 *
 * Issue #1007 — Mock Stellar Horizon / Soroban RPC service for deterministic tests.
 *
 * Provides a unified, in-process mock for:
 *  - Stellar Horizon REST API  (https://horizon.stellar.org)
 *  - Soroban RPC JSON-RPC 2.0  (https://soroban-testnet.stellar.org/soroban/rpc)
 *
 * All handlers are built on top of the MSW (Mock Service Worker) library that
 * is already installed and configured in this project, so they integrate with
 * the existing `src/test/mocks/server.ts` setup without adding new dependencies.
 *
 * ## Usage
 *
 * ### Opt-in to Stellar mocks in a single test file
 * ```ts
 * import { server } from '@/test/mocks/server';
 * import { stellarMockHandlers } from '@/test/mocks/stellar-mock-service';
 * // Add handlers *only* for this describe block
 * beforeAll(() => server.use(...stellarMockHandlers));
 * ```
 *
 * ### Override a single endpoint within a test
 * ```ts
 * import { http, HttpResponse } from 'msw';
 * import { server } from '@/test/mocks/server';
 * import { HORIZON_BASE, SOROBAN_RPC_URL } from '@/test/mocks/stellar-mock-service';
 *
 * it('handles insufficient balance', () => {
 *   server.use(
 *     http.get(`${HORIZON_BASE}/accounts/:address`, () =>
 *       HttpResponse.json(
 *         buildHorizonAccount('GEXAMPLE', [{ asset_type: 'native', balance: '0.5000000' }])
 *       )
 *     )
 *   );
 *   // … test body …
 * });
 * ```
 *
 * ### Reset to defaults after a test
 * ```ts
 * afterEach(() => server.resetHandlers());
 * ```
 *
 * ## Why this file exists
 *
 * Without a mock, unit and integration tests that exercise Stellar-related code
 * paths make real network calls to testnet endpoints.  Those calls are:
 *  - Slow  (round-trip adds hundreds of milliseconds per test)
 *  - Flaky (testnet availability varies; rate-limits apply)
 *  - Non-deterministic (ledger state changes between runs)
 *
 * This service eliminates those problems by intercepting all matching requests
 * at the network layer and returning canned, reproducible responses.
 *
 * ## Contributor notes
 *
 * - Add new handler factories at the bottom of the "Factory helpers" section.
 * - If you need a ledger state that does not fit any existing factory, compose
 *   one with the exported builder functions (`buildHorizonAccount`,
 *   `buildSorobanResult`, etc.) and pass it to `server.use()` inside your test.
 * - This file must not import from `src/lib` or `src/app` — it is test infrastructure,
 *   not production code.  Import only from `msw`, `vitest`, and Node builtins.
 */

import { http, HttpResponse, type HttpHandler } from 'msw';

// ─────────────────────────────────────────────────────────────────────────────
// Base URLs (kept in sync with vitest.config.ts env block)
// ─────────────────────────────────────────────────────────────────────────────

/** Base URL for the mocked Horizon REST API. */
export const HORIZON_BASE = 'https://horizon.stellar.org';

/** Base URL for the mocked Horizon testnet. */
export const HORIZON_TESTNET_BASE = 'https://horizon-testnet.stellar.org';

/** Soroban RPC endpoint used in tests. */
export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org/soroban/rpc';

// ─────────────────────────────────────────────────────────────────────────────
// Static fixture data
// ─────────────────────────────────────────────────────────────────────────────

const USDC_ISSUER = 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB6HP';

const DEFAULT_BALANCES = [
  { asset_type: 'native', balance: '1000.0000000' },
  {
    asset_code: 'USDC',
    asset_issuer: USDC_ISSUER,
    asset_type: 'credit_alphanum4',
    balance: '500.0000000',
    limit: '922337203685.4775807',
    is_authorized: true,
  },
];

const DEFAULT_TRANSACTION = {
  successful: true,
  ledger: 50_000_001,
  created_at: '2026-01-01T00:00:00Z',
  envelope_xdr: 'AAAAAgAAAAB...',
  result_xdr: 'AAAAAAAAAGQ...',
  result_meta_xdr: 'AAAAAAAAAAA...',
  fee_charged: '100',
  max_fee: '100',
};

// ─────────────────────────────────────────────────────────────────────────────
// Builder helpers — produce type-correct fixture objects
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal Horizon account object. */
export function buildHorizonAccount(
  address: string,
  balances: typeof DEFAULT_BALANCES = DEFAULT_BALANCES,
): Record<string, unknown> {
  return {
    id: address,
    account_id: address,
    paging_token: address,
    sequence: '12345678901234567',
    subentry_count: 1,
    last_modified_ledger: 50_000_000,
    thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
    flags: { auth_required: false, auth_revocable: false, auth_immutable: false },
    balances,
    signers: [{ public_key: address, weight: 1, type: 'ed25519_public_key', key: address }],
    data: {},
    num_sponsoring: 0,
    num_sponsored: 0,
  };
}

/** Build a minimal Horizon transaction response. */
export function buildHorizonTransaction(
  hash: string,
  overrides: Partial<typeof DEFAULT_TRANSACTION> = {},
): Record<string, unknown> {
  return {
    ...DEFAULT_TRANSACTION,
    id: hash,
    hash,
    paging_token: hash,
    ...overrides,
  };
}

/** Build a Soroban RPC success result. */
export function buildSorobanResult(
  id: number | string = 1,
  result: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      status: 'SUCCESS',
      ledger: 50_000_001,
      createdAt: '1700000000',
      envelopeXdr: 'AAAAAgAAAAB...',
      resultXdr: 'AAAAAAAAAGQ...',
      resultMetaXdr: 'AAAAAAAAAAA...',
      ...result,
    },
  };
}

/** Build a Soroban RPC error response (application-level, not HTTP-level). */
export function buildSorobanError(
  id: number | string = 1,
  code: number = -32600,
  message: string = 'Invalid request',
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message },
  };
}

/** Build a Soroban RPC simulation result. */
export function buildSorobanSimulateResult(
  id: number | string = 1,
  minResourceFee: string = '100',
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      minResourceFee,
      transactionData: 'AAAAAAAAAAA...',
      events: [],
      results: [{ xdr: 'AAAA...' }],
      cost: { cpuInsns: '1000', memBytes: '1000' },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Horizon handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Horizon GET /accounts/:address
 * Returns a funded account with native + USDC balances.
 */
export const horizonAccountHandler: HttpHandler = http.get(
  `${HORIZON_BASE}/accounts/:address`,
  ({ params }) => {
    const { address } = params as { address: string };
    return HttpResponse.json(buildHorizonAccount(address));
  },
);

/**
 * Horizon testnet GET /accounts/:address
 * Mirrors the mainnet handler for testnet-targeted code.
 */
export const horizonTestnetAccountHandler: HttpHandler = http.get(
  `${HORIZON_TESTNET_BASE}/accounts/:address`,
  ({ params }) => {
    const { address } = params as { address: string };
    return HttpResponse.json(buildHorizonAccount(address));
  },
);

/**
 * Horizon GET /transactions/:hash
 * Returns a successful transaction.
 */
export const horizonTransactionHandler: HttpHandler = http.get(
  `${HORIZON_BASE}/transactions/:hash`,
  ({ params }) => {
    const { hash } = params as { hash: string };
    return HttpResponse.json(buildHorizonTransaction(hash));
  },
);

/**
 * Horizon testnet GET /transactions/:hash
 */
export const horizonTestnetTransactionHandler: HttpHandler = http.get(
  `${HORIZON_TESTNET_BASE}/transactions/:hash`,
  ({ params }) => {
    const { hash } = params as { hash: string };
    return HttpResponse.json(buildHorizonTransaction(hash));
  },
);

/**
 * Horizon POST /transactions
 * Simulates a successfully submitted transaction.
 */
export const horizonSubmitTransactionHandler: HttpHandler = http.post(
  `${HORIZON_BASE}/transactions`,
  async () => {
    const hash = 'a'.repeat(64);
    return HttpResponse.json(buildHorizonTransaction(hash, { paging_token: hash }));
  },
);

/**
 * Horizon testnet POST /transactions
 */
export const horizonTestnetSubmitTransactionHandler: HttpHandler = http.post(
  `${HORIZON_TESTNET_BASE}/transactions`,
  async () => {
    const hash = 'b'.repeat(64);
    return HttpResponse.json(buildHorizonTransaction(hash, { paging_token: hash }));
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Soroban RPC handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soroban RPC POST endpoint — dispatches on `method` field.
 *
 * Supported methods:
 *  - simulateTransaction  → simulateResult
 *  - sendTransaction      → SUCCESS status
 *  - getTransaction       → COMPLETE status
 *  - getLedgerEntry       → 404-like not-found response
 *  - getLatestLedger      → current ledger info
 *  - getNetwork           → network passphrase
 *  - getHealth            → healthy
 */
export const sorobanRpcHandler: HttpHandler = http.post(SOROBAN_RPC_URL, async ({ request }) => {
  let body: { jsonrpc?: string; id?: number | string; method?: string; params?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return HttpResponse.json(buildSorobanError(0, -32700, 'Parse error'));
  }

  const { id = 1, method = '' } = body;

  switch (method) {
    case 'simulateTransaction':
      return HttpResponse.json(buildSorobanSimulateResult(id));

    case 'sendTransaction':
      return HttpResponse.json(
        buildSorobanResult(id, {
          hash: 'c'.repeat(64),
          status: 'PENDING',
        }),
      );

    case 'getTransaction':
      return HttpResponse.json(
        buildSorobanResult(id, {
          status: 'SUCCESS',
          ledger: 50_000_002,
        }),
      );

    case 'getLedgerEntry':
      return HttpResponse.json(buildSorobanError(id, 404, 'Not Found'));

    case 'getLatestLedger':
      return HttpResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          id: 'ledger-hash-' + 'd'.repeat(48),
          sequence: 50_000_001,
          protocolVersion: 20,
        },
      });

    case 'getNetwork':
      return HttpResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          friendbotUrl: null,
          passphrase: 'Test SDF Network ; September 2015',
          protocolVersion: 20,
        },
      });

    case 'getHealth':
      return HttpResponse.json({
        jsonrpc: '2.0',
        id,
        result: { status: 'healthy', latestLedger: 50_000_001 },
      });

    default:
      return HttpResponse.json(buildSorobanError(id, -32601, `Method not found: ${method}`));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Convenience handler factories for edge-case testing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory: a Horizon account handler that returns an account with zero USDC.
 * Use with `server.use(horizonZeroBalanceHandler('GABCD…'))` inside a test.
 */
export function makeHorizonZeroUsdcHandler(address: string): HttpHandler {
  return http.get(`${HORIZON_BASE}/accounts/${address}`, () =>
    HttpResponse.json(
      buildHorizonAccount(address, [{ asset_type: 'native', balance: '1000.0000000' }]),
    ),
  );
}

/**
 * Factory: a Horizon account handler for an account with a specific USDC balance.
 */
export function makeHorizonUsdcBalanceHandler(address: string, usdcBalance: string): HttpHandler {
  return http.get(`${HORIZON_BASE}/accounts/${address}`, () =>
    HttpResponse.json(
      buildHorizonAccount(address, [
        { asset_type: 'native', balance: '100.0000000' },
        {
          asset_code: 'USDC',
          asset_issuer: USDC_ISSUER,
          asset_type: 'credit_alphanum4',
          balance: usdcBalance,
          limit: '922337203685.4775807',
          is_authorized: true,
        },
      ]),
    ),
  );
}

/**
 * Factory: a Horizon account handler that returns a 404 (account not found).
 */
export function makeHorizonNotFoundHandler(address: string): HttpHandler {
  return http.get(`${HORIZON_BASE}/accounts/${address}`, () =>
    HttpResponse.json({ type: 'https://stellar.org/horizon-errors/not_found' }, { status: 404 }),
  );
}

/**
 * Factory: a Soroban RPC handler that simulates a failed transaction.
 */
export function makeSorobanFailedTxHandler(): HttpHandler {
  return http.post(SOROBAN_RPC_URL, async ({ request }) => {
    const body = (await request.json()) as { id?: number | string; method?: string };
    return HttpResponse.json(
      buildSorobanResult(body.id ?? 1, {
        status: 'FAILED',
        resultXdr: 'AAAAAAAAAMj...',
      }),
    );
  });
}

/**
 * Factory: a Soroban RPC handler that simulates a network timeout (500 error).
 */
export function makeSorobanTimeoutHandler(): HttpHandler {
  return http.post(SOROBAN_RPC_URL, () =>
    HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundled export: all default Stellar mock handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All default Stellar mock handlers.
 *
 * Add to an existing MSW server:
 * ```ts
 * import { stellarMockHandlers } from '@/test/mocks/stellar-mock-service';
 * server.use(...stellarMockHandlers);
 * ```
 *
 * Or use as the sole source of handlers:
 * ```ts
 * import { setupServer } from 'msw/node';
 * import { stellarMockHandlers } from '@/test/mocks/stellar-mock-service';
 * const server = setupServer(...stellarMockHandlers);
 * ```
 */
export const stellarMockHandlers: HttpHandler[] = [
  horizonAccountHandler,
  horizonTestnetAccountHandler,
  horizonTransactionHandler,
  horizonTestnetTransactionHandler,
  horizonSubmitTransactionHandler,
  horizonTestnetSubmitTransactionHandler,
  sorobanRpcHandler,
];

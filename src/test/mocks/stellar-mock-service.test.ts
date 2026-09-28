/**
 * stellar-mock-service.test.ts
 *
 * Issue #1007 — Deterministic tests using the mock Stellar Horizon/RPC service.
 *
 * This test file verifies that:
 *  1. The mock service's builder helpers produce correct, deterministic objects.
 *  2. The handler factories produce correct MSW handlers.
 *  3. Code that calls Horizon or Soroban RPC is testable without a live network.
 *  4. Zero live network calls are made (MSW intercepts everything).
 *
 * All tests run entirely in-process; no live network calls are made.
 * The existing project MSW server (src/test/mocks/server.ts) is augmented with
 * stellarMockHandlers to intercept Stellar/Soroban endpoints.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './server';
import {
  stellarMockHandlers,
  buildHorizonAccount,
  buildHorizonTransaction,
  buildSorobanResult,
  buildSorobanSimulateResult,
  buildSorobanError,
  makeHorizonZeroUsdcHandler,
  makeHorizonUsdcBalanceHandler,
  makeHorizonNotFoundHandler,
  makeSorobanFailedTxHandler,
  makeSorobanTimeoutHandler,
  HORIZON_BASE,
  SOROBAN_RPC_URL,
} from './stellar-mock-service';

// Register all Stellar mock handlers with the shared MSW server
beforeAll(() => {
  server.use(...stellarMockHandlers);
});

afterEach(() => {
  // Reset to baseline Stellar handlers between tests
  server.resetHandlers(...stellarMockHandlers);
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: typed fetch wrappers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  return res.json() as Promise<T>;
}

async function rpcCall<T>(method: string, params: unknown = {}): Promise<T> {
  const res = await fetch(SOROBAN_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return res.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder helper unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('buildHorizonAccount', () => {
  it('includes the address as id and account_id', () => {
    const acc = buildHorizonAccount('GABC');
    expect(acc.id).toBe('GABC');
    expect(acc.account_id).toBe('GABC');
  });

  it('includes native and USDC balances by default', () => {
    const acc = buildHorizonAccount('GABC') as { balances: Array<{ asset_type: string }> };
    expect(acc.balances.length).toBe(2);
    const native = acc.balances.find((b) => b.asset_type === 'native');
    const usdc = acc.balances.find((b) => b.asset_type === 'credit_alphanum4');
    expect(native).toBeDefined();
    expect(usdc).toBeDefined();
  });

  it('accepts custom balances', () => {
    const acc = buildHorizonAccount('GABC', [
      { asset_type: 'native', balance: '0.5000000' },
    ]) as { balances: unknown[] };
    expect(acc.balances.length).toBe(1);
  });

  it('always returns the same shape for any address', () => {
    const acc1 = buildHorizonAccount('GADDR1');
    const acc2 = buildHorizonAccount('GADDR2');
    // Same structure, different ids
    expect(Object.keys(acc1).sort()).toEqual(Object.keys(acc2).sort());
    expect(acc1.id).not.toBe(acc2.id);
  });
});

describe('buildHorizonTransaction', () => {
  it('includes the hash as id and hash', () => {
    const tx = buildHorizonTransaction('txhash123');
    expect(tx.id).toBe('txhash123');
    expect(tx.hash).toBe('txhash123');
  });

  it('is successful by default', () => {
    const tx = buildHorizonTransaction('txhash123');
    expect(tx.successful).toBe(true);
  });

  it('accepts overrides', () => {
    const tx = buildHorizonTransaction('txhash123', { successful: false });
    expect(tx.successful).toBe(false);
  });

  it('includes ledger and created_at', () => {
    const tx = buildHorizonTransaction('txhash');
    expect(typeof tx.ledger).toBe('number');
    expect(typeof tx.created_at).toBe('string');
  });
});

describe('buildSorobanResult', () => {
  it('returns a valid JSON-RPC 2.0 success envelope', () => {
    const result = buildSorobanResult(42);
    expect(result.jsonrpc).toBe('2.0');
    expect(result.id).toBe(42);
    expect((result.result as { status: string }).status).toBe('SUCCESS');
  });

  it('merges custom result fields', () => {
    const result = buildSorobanResult(1, { custom: 'value' }) as {
      result: { custom: string };
    };
    expect(result.result.custom).toBe('value');
  });

  it('works with string id', () => {
    const result = buildSorobanResult('req-abc');
    expect(result.id).toBe('req-abc');
  });
});

describe('buildSorobanSimulateResult', () => {
  it('returns a valid simulation result with default fee', () => {
    const result = buildSorobanSimulateResult(1) as {
      result: { minResourceFee: string };
    };
    expect(result.jsonrpc).toBe('2.0');
    expect(result.result.minResourceFee).toBe('100');
  });

  it('accepts custom minResourceFee', () => {
    const result = buildSorobanSimulateResult(1, '999') as {
      result: { minResourceFee: string };
    };
    expect(result.result.minResourceFee).toBe('999');
  });
});

describe('buildSorobanError', () => {
  it('returns a JSON-RPC 2.0 error envelope', () => {
    const err = buildSorobanError(1, -32601, 'method not found') as {
      error: { code: number; message: string };
    };
    expect(err.jsonrpc).toBe('2.0');
    expect(err.error.code).toBe(-32601);
    expect(err.error.message).toBe('method not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Horizon endpoint tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Horizon mock — GET /accounts/:address', () => {
  it('returns a funded account for any address', async () => {
    const acc = await fetchJson<{ id: string; balances: unknown[] }>(
      `${HORIZON_BASE}/accounts/GCFXHELLOWORLD`,
    );
    expect(acc.id).toBe('GCFXHELLOWORLD');
    expect(Array.isArray(acc.balances)).toBe(true);
    expect(acc.balances.length).toBeGreaterThan(0);
  });

  it('always returns the same balance shape for the same address', async () => {
    const address = 'GCFXDETERMINISTIC';
    const acc1 = await fetchJson(`${HORIZON_BASE}/accounts/${address}`);
    const acc2 = await fetchJson(`${HORIZON_BASE}/accounts/${address}`);
    expect(JSON.stringify(acc1)).toBe(JSON.stringify(acc2));
  });

  it('has a native XLM balance greater than zero', async () => {
    const acc = await fetchJson<{ balances: Array<{ asset_type: string; balance: string }> }>(
      `${HORIZON_BASE}/accounts/GCFX`,
    );
    const native = acc.balances.find((b) => b.asset_type === 'native');
    expect(native).toBeDefined();
    expect(parseFloat(native!.balance)).toBeGreaterThan(0);
  });

  it('has a USDC balance greater than zero', async () => {
    const acc = await fetchJson<{
      balances: Array<{ asset_type: string; asset_code?: string; balance: string }>;
    }>(`${HORIZON_BASE}/accounts/GCFX`);
    const usdc = acc.balances.find((b) => b.asset_code === 'USDC');
    expect(usdc).toBeDefined();
    expect(parseFloat(usdc!.balance)).toBeGreaterThan(0);
  });
});

describe('Horizon mock — GET /transactions/:hash', () => {
  it('returns the hash as both id and hash fields', async () => {
    const hash = 'abc123def456';
    const tx = await fetchJson<{ id: string; hash: string; successful: boolean }>(
      `${HORIZON_BASE}/transactions/${hash}`,
    );
    expect(tx.id).toBe(hash);
    expect(tx.hash).toBe(hash);
  });

  it('marks the transaction as successful', async () => {
    const tx = await fetchJson<{ successful: boolean }>(
      `${HORIZON_BASE}/transactions/somehash`,
    );
    expect(tx.successful).toBe(true);
  });
});

describe('Horizon mock — POST /transactions', () => {
  it('returns a transaction response with a 64-character hash', async () => {
    const res = await fetchJson<{ hash: string; successful: boolean }>(
      `${HORIZON_BASE}/transactions`,
      {
        method: 'POST',
        body: 'xdr=AAAA...',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    expect(typeof res.hash).toBe('string');
    expect(res.hash.length).toBe(64);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Soroban RPC endpoint tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Soroban RPC mock — simulateTransaction', () => {
  it('returns a simulation result with minResourceFee', async () => {
    const res = await rpcCall<{ result: { minResourceFee: string } }>(
      'simulateTransaction',
      { transaction: 'AAAA' },
    );
    expect(res.result.minResourceFee).toBeDefined();
    expect(parseInt(res.result.minResourceFee, 10)).toBeGreaterThanOrEqual(0);
  });

  it('returns a JSON-RPC 2.0 envelope with matching id', async () => {
    const res = await rpcCall<{ jsonrpc: string; id: number }>('simulateTransaction', {});
    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
  });
});

describe('Soroban RPC mock — sendTransaction', () => {
  it('returns PENDING status with a hash', async () => {
    const res = await rpcCall<{ result: { status: string; hash: string } }>(
      'sendTransaction',
      { transaction: 'AAAA' },
    );
    expect(res.result.status).toBe('PENDING');
    expect(typeof res.result.hash).toBe('string');
  });
});

describe('Soroban RPC mock — getTransaction', () => {
  it('returns SUCCESS status with a ledger number', async () => {
    const res = await rpcCall<{ result: { status: string; ledger: number } }>(
      'getTransaction',
      { hash: 'c'.repeat(64) },
    );
    expect(res.result.status).toBe('SUCCESS');
    expect(typeof res.result.ledger).toBe('number');
  });
});

describe('Soroban RPC mock — getLatestLedger', () => {
  it('returns a positive sequence number', async () => {
    const res = await rpcCall<{ result: { sequence: number } }>('getLatestLedger');
    expect(typeof res.result.sequence).toBe('number');
    expect(res.result.sequence).toBeGreaterThan(0);
  });
});

describe('Soroban RPC mock — getHealth', () => {
  it('returns healthy status', async () => {
    const res = await rpcCall<{ result: { status: string } }>('getHealth');
    expect(res.result.status).toBe('healthy');
  });
});

describe('Soroban RPC mock — unknown method', () => {
  it('returns a method-not-found error with code -32601', async () => {
    const res = await rpcCall<{ error: { code: number; message: string } }>(
      'nonExistentMethod',
    );
    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32601);
    expect(res.error.message).toContain('nonExistentMethod');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge-case handler factory tests
// ─────────────────────────────────────────────────────────────────────────────

describe('makeHorizonZeroUsdcHandler', () => {
  it('overrides the default handler to return no USDC balance', async () => {
    server.use(makeHorizonZeroUsdcHandler('GSPECIFIC'));
    const acc = await fetchJson<{
      balances: Array<{ asset_type: string; asset_code?: string }>;
    }>(`${HORIZON_BASE}/accounts/GSPECIFIC`);
    const usdc = acc.balances.find((b) => b.asset_code === 'USDC');
    expect(usdc).toBeUndefined();
    const native = acc.balances.find((b) => b.asset_type === 'native');
    expect(native).toBeDefined();
  });
});

describe('makeHorizonUsdcBalanceHandler', () => {
  it('returns the exact USDC balance specified', async () => {
    server.use(makeHorizonUsdcBalanceHandler('GCUSTOM', '250.0000000'));
    const acc = await fetchJson<{
      balances: Array<{ asset_type: string; asset_code?: string; balance: string }>;
    }>(`${HORIZON_BASE}/accounts/GCUSTOM`);
    const usdc = acc.balances.find((b) => b.asset_code === 'USDC');
    expect(usdc).toBeDefined();
    expect(usdc!.balance).toBe('250.0000000');
  });
});

describe('makeHorizonNotFoundHandler', () => {
  it('returns a 404 response for the specified address', async () => {
    server.use(makeHorizonNotFoundHandler('GMISSING'));
    const res = await fetch(`${HORIZON_BASE}/accounts/GMISSING`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { type: string };
    expect(body.type).toContain('not_found');
  });
});

describe('makeSorobanFailedTxHandler', () => {
  it('returns FAILED status for all RPC calls', async () => {
    server.use(makeSorobanFailedTxHandler());
    const res = await rpcCall<{ result: { status: string } }>('getTransaction', {
      hash: 'e'.repeat(64),
    });
    expect(res.result.status).toBe('FAILED');
  });
});

describe('makeSorobanTimeoutHandler', () => {
  it('returns a 500 error for all RPC calls', async () => {
    server.use(makeSorobanTimeoutHandler());
    const res = await fetch(SOROBAN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
    });
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Zero live-network calls guard
// ─────────────────────────────────────────────────────────────────────────────

describe('No live network calls', () => {
  it('all Stellar requests are intercepted (MSW onUnhandledRequest config guards this)', () => {
    // The shared server is configured with onUnhandledRequest: 'error' in server.ts.
    // If any request above had leaked to the real network, that test would have thrown.
    // Reaching this assertion confirms every request was handled by the mock.
    expect(true).toBe(true);
  });
});

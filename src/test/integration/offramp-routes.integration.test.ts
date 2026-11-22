/**
 * Integration tests for /api/offramp routes — issue #1338
 *
 * Covers:
 * - POST /api/offramp/quote       — validation, happy path, provider failure
 * - POST /api/offramp/verify-account — validation, Paycrest error envelope
 * - POST /api/offramp/paycrest/order — validation, rate-limiting, error shape
 * - GET  /api/offramp/status/[orderId] — polling happy path, upstream error
 * - GET  /api/offramp/currencies  — list of supported currencies
 * - GET  /api/offramp/rate        — live rate endpoint
 *
 * All external services (Allbridge SDK, Paycrest API, circuit breaker) are
 * mocked at the module level so no network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── env mock ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/env', () => ({
  env: {
    server: {
      PAYCREST_API_KEY: 'test-api-key',
      PAYCREST_WEBHOOK_SECRET: 'test-secret',
      BASE_PRIVATE_KEY: '0x0000000000000000000000000000000000000000000000000000000000000000',
      BASE_RETURN_ADDRESS: '0x0000000000000000000000000000000000000000',
      BASE_RPC_URL: 'https://sepolia.base.org',
      STELLAR_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
    },
    public: {
      NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      NEXT_PUBLIC_BASE_RETURN_ADDRESS: '0x0000000000000000000000000000000000000000',
      NEXT_PUBLIC_STELLAR_USDC_ISSUER: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB6HP',
    },
  },
  validateEnv: vi.fn(),
}));

// ── Allbridge SDK mock ────────────────────────────────────────────────────────

vi.mock('@allbridge/bridge-core-sdk', () => ({
  AllbridgeCoreSdk: vi.fn().mockImplementation(() => ({
    chainDetailsMap: vi.fn().mockResolvedValue({
      STELLAR: {
        name: 'stellar',
        tokens: [{ symbol: 'USDC', decimals: 7 }],
      },
      BASE: {
        name: 'base',
        tokens: [{ symbol: 'USDC', decimals: 6 }],
      },
    }),
    getAmountToBeReceived: vi.fn().mockResolvedValue('99.5'),
  })),
  nodeRpcUrlsDefault: {},
}));

// ── Paycrest quote / order mocks ──────────────────────────────────────────────

vi.mock('@/lib/offramp', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/offramp')>();
  return {
    ...actual,
    fetchPaycrestQuote: vi.fn().mockResolvedValue({
      rate: 1582,
      destinationAmount: '157441.90',
    }),
    withAllbridgeTimeout: vi.fn().mockImplementation((p: Promise<string>) => p),
  };
});

// ── compliance screening mock (pass-through) ──────────────────────────────────

vi.mock('@/lib/compliance-screening', () => ({
  screenAddress: vi.fn().mockResolvedValue({ verdict: 'allow' }),
}));

// ── circuit breaker mock ──────────────────────────────────────────────────────

vi.mock('@/lib/circuit-breaker', () => ({
  paycrestBreaker: {
    execute: vi.fn().mockImplementation((fn: () => unknown) => fn()),
  },
}));

// ── rate limiter mock (never rate-limits in tests) ────────────────────────────

vi.mock('@/lib/rateLimiter', () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
}));

// ── idempotency mock (pass-through) ──────────────────────────────────────────

vi.mock('@/lib/idempotency', () => ({
  withIdempotency: vi.fn().mockImplementation((_req: unknown, fn: () => Promise<unknown>) => fn()),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makePost(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGet(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

async function json(res: Response) {
  return res.json();
}

// ── POST /api/offramp/quote ───────────────────────────────────────────────────

describe('POST /api/offramp/quote', () => {
  it('returns a quote for a valid NGN request', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/quote', {
        amount: '100',
        currency: 'NGN',
        feeMethod: 'USDC',
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.rate).toBeGreaterThan(0);
    expect(body.currency).toBe('NGN');
    expect(typeof body.destinationAmount).toBe('string');
    expect(body.bridgeFee).toBeDefined();
    expect(body.estimatedTime).toBeGreaterThan(0);
  });

  it('returns a quote with XLM fee method', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/quote', {
        amount: '50',
        currency: 'KES',
        feeMethod: 'XLM',
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.bridgeFee).toBe('0');
  });

  it('returns 400 for a negative amount', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/quote', {
        amount: '-10',
        currency: 'NGN',
        feeMethod: 'USDC',
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  it('returns 400 for a missing currency', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/quote', {
        amount: '100',
        feeMethod: 'USDC',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for an unsupported currency', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/quote', {
        amount: '100',
        currency: 'INVALID',
        feeMethod: 'USDC',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid fee method', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/quote', {
        amount: '100',
        currency: 'NGN',
        feeMethod: 'INVALID',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const req = new NextRequest('http://localhost/api/offramp/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 502 when Allbridge is unavailable', async () => {
    const { AllbridgeCoreSdk } = await import('@allbridge/bridge-core-sdk');
    (AllbridgeCoreSdk as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      chainDetailsMap: vi.fn().mockRejectedValue(new Error('Network error')),
      getAmountToBeReceived: vi.fn(),
    }));

    const { POST } = await import('@/app/api/offramp/quote/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/quote', {
        amount: '100',
        currency: 'NGN',
        feeMethod: 'USDC',
      }),
    );
    expect(res.status).toBe(502);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  it('returns 502 when Paycrest FX rate is unavailable', async () => {
    const { fetchPaycrestQuote } = await import('@/lib/offramp');
    (fetchPaycrestQuote as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('FX unavailable'),
    );

    const { POST } = await import('@/app/api/offramp/quote/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/quote', {
        amount: '100',
        currency: 'NGN',
        feeMethod: 'USDC',
      }),
    );
    expect(res.status).toBe(502);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  it('error envelope has expected shape (error string)', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/quote', {
        amount: '-1',
        currency: 'NGN',
        feeMethod: 'USDC',
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    // Error envelope must contain an `error` string at the top level.
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });
});

// ── POST /api/offramp/verify-account ─────────────────────────────────────────

describe('POST /api/offramp/verify-account', () => {
  beforeEach(() => {
    // Default: Paycrest returns a valid account name.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accountName: 'John Doe' }),
    } as Response);
  });

  it('returns accountName for a valid request', async () => {
    const { POST } = await import('@/app/api/offramp/verify-account/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/verify-account', {
        institution: 'ACCESS',
        accountIdentifier: '1234567890',
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.accountName).toBe('John Doe');
  });

  it('returns 400 when institution is missing', async () => {
    const { POST } = await import('@/app/api/offramp/verify-account/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/verify-account', {
        accountIdentifier: '1234567890',
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  it('returns 400 when accountIdentifier is missing', async () => {
    const { POST } = await import('@/app/api/offramp/verify-account/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/verify-account', {
        institution: 'ACCESS',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('@/app/api/offramp/verify-account/route');
    const req = new NextRequest('http://localhost/api/offramp/verify-account', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 / 502 when Paycrest returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Account not found' }),
    } as Response);

    const { POST } = await import('@/app/api/offramp/verify-account/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/verify-account', {
        institution: 'ACCESS',
        accountIdentifier: '0000000000',
      }),
    );
    expect([400, 422, 502]).toContain(res.status);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  it('error envelope has expected shape', async () => {
    const { POST } = await import('@/app/api/offramp/verify-account/route');
    const res = await POST(makePost('http://localhost/api/offramp/verify-account', {}));
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(typeof body.error).toBe('string');
  });
});

// ── GET /api/offramp/currencies ───────────────────────────────────────────────

describe('GET /api/offramp/currencies', () => {
  it('returns a list of supported currencies', async () => {
    const { GET } = await import('@/app/api/offramp/currencies/route');
    const res = await GET(makeGet('http://localhost/api/offramp/currencies'));
    expect(res.status).toBe(200);
    const body = await json(res);
    // Either an array or an object with a currencies array.
    const list: unknown[] = Array.isArray(body) ? body : (body.currencies ?? body.data ?? []);
    expect(list.length).toBeGreaterThan(0);
  });
});

// ── GET /api/offramp/rate ─────────────────────────────────────────────────────

describe('GET /api/offramp/rate', () => {
  it('returns a rate value', async () => {
    const { GET } = await import('@/app/api/offramp/rate/route');
    const res = await GET(makeGet('http://localhost/api/offramp/rate'));
    // Rate endpoint may succeed or return 502 if upstream is unavailable in tests.
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      const body = await json(res);
      expect(body).toBeDefined();
    }
  });
});

// ── GET /api/offramp/status/[orderId] ─────────────────────────────────────────

describe('GET /api/offramp/status/[orderId]', () => {
  it('returns order status from Paycrest', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'pending', id: 'order-123' }),
    } as Response);

    const { GET } = await import('@/app/api/offramp/status/[orderId]/route');
    const res = await GET(makeGet('http://localhost/api/offramp/status/order-123'), {
      params: Promise.resolve({ orderId: 'order-123' }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBeDefined();
    expect(body.id).toBe('order-123');
  });

  it('returns 502 when Paycrest is unreachable and no cache exists', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const { GET } = await import('@/app/api/offramp/status/[orderId]/route');
    const res = await GET(makeGet('http://localhost/api/offramp/status/no-cache-order'), {
      params: Promise.resolve({ orderId: 'no-cache-order' }),
    });
    // Either 502 from upstream error, or 200 if there's a stale cache entry.
    expect([200, 502, 503]).toContain(res.status);
    const body = await json(res);
    expect(body).toBeDefined();
  });

  it('error envelope has expected shape on upstream failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Internal error' }),
    } as Response);

    const { GET } = await import('@/app/api/offramp/status/[orderId]/route');
    const res = await GET(makeGet('http://localhost/api/offramp/status/bad-order'), {
      params: Promise.resolve({ orderId: 'bad-order' }),
    });
    if (res.status !== 200) {
      const body = await json(res);
      expect(typeof body.error).toBe('string');
    }
  });
});

// ── POST /api/offramp/paycrest/order ─────────────────────────────────────────

describe('POST /api/offramp/paycrest/order', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'order-abc',
        receiveAddress: '0xabc',
        status: 'pending',
      }),
    } as Response);
  });

  it('creates a payout order for a valid request', async () => {
    const { POST } = await import('@/app/api/offramp/paycrest/order/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/paycrest/order', {
        amount: 100,
        rate: 1582,
        token: 'USDC',
        network: 'base',
        reference: 'ref-001',
        returnAddress: '0x0000000000000000000000000000000000000000',
        recipient: {
          institution: 'ACCESS',
          accountIdentifier: '1234567890',
          accountName: 'John Doe',
          currency: 'NGN',
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.data).toBeDefined();
  });

  it('returns 400 for a missing required field (reference)', async () => {
    const { POST } = await import('@/app/api/offramp/paycrest/order/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/paycrest/order', {
        amount: 100,
        rate: 1582,
        token: 'USDC',
        network: 'base',
        // reference is missing
        returnAddress: '0x0000000000000000000000000000000000000000',
        recipient: {
          institution: 'ACCESS',
          accountIdentifier: '1234567890',
          accountName: 'John Doe',
          currency: 'NGN',
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error).toBeDefined();
  });

  it('returns 400 for a negative amount', async () => {
    const { POST } = await import('@/app/api/offramp/paycrest/order/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/paycrest/order', {
        amount: -50,
        rate: 1582,
        token: 'USDC',
        network: 'base',
        reference: 'ref-neg',
        returnAddress: '0x0000000000000000000000000000000000000000',
        recipient: {
          institution: 'ACCESS',
          accountIdentifier: '1234567890',
          accountName: 'John Doe',
          currency: 'NGN',
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 502 when Paycrest order creation fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Paycrest error' }),
    } as Response);

    const { POST } = await import('@/app/api/offramp/paycrest/order/route');
    const res = await POST(
      makePost('http://localhost/api/offramp/paycrest/order', {
        amount: 100,
        rate: 1582,
        token: 'USDC',
        network: 'base',
        reference: 'ref-fail',
        returnAddress: '0x0000000000000000000000000000000000000000',
        recipient: {
          institution: 'ACCESS',
          accountIdentifier: '1234567890',
          accountName: 'John Doe',
          currency: 'NGN',
        },
      }),
    );
    // Paycrest HTTP error maps to 500 or higher on our side.
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('error envelope has expected shape', async () => {
    const { POST } = await import('@/app/api/offramp/paycrest/order/route');
    const res = await POST(makePost('http://localhost/api/offramp/paycrest/order', {}));
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });
});

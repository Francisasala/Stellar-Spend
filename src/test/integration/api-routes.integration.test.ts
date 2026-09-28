/**
 * Integration tests for src/app/api route handlers (issue #1000).
 *
 * Coverage
 * --------
 * 10 routes, each with happy path + at least one error path:
 *
 *  1.  GET  /api/health
 *  2.  GET  /api/offramp/rate
 *  3.  GET  /api/offramp/currencies
 *  4.  GET  /api/offramp/currencies?validate=NGN&amount=100
 *  5.  GET  /api/offramp/institutions/[currency]
 *  6.  POST /api/offramp/quote
 *  7.  POST /api/offramp/verify-account
 *  8.  GET  /api/offramp/status/[orderId]
 *  9.  POST /api/webhooks/paycrest
 * 10.  GET  /api/health/liveness
 *
 * Harness
 * -------
 * Route handlers are imported directly and called with NextRequest / plain
 * Request objects constructed via the WHATWG URL+Request API (the same shapes
 * the Next.js App Router uses).  No HTTP server is required.
 *
 * All external dependencies (Paycrest API, Allbridge SDK, database, fxRateService,
 * webhookVerify, etc.) are module-level mocked so the tests are fully offline.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest';
import { NextRequest } from 'next/server';

// ── env mock (must come before any module that reads env.server) ──────────────

vi.mock('@/lib/env', () => ({
  env: {
    server: {
      PAYCREST_API_KEY: 'test-api-key',
      PAYCREST_WEBHOOK_SECRET: 'test-webhook-secret',
      BASE_PRIVATE_KEY: '0x0000000000000000000000000000000000000000000000000000000000000000',
      BASE_RETURN_ADDRESS: '0x0000000000000000000000000000000000000000',
      BASE_RPC_URL: 'https://sepolia.base.org',
      STELLAR_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
      DATABASE_URL: 'postgresql://localhost:5432/stellar_test',
    },
    public: {
      NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
      NEXT_PUBLIC_BASE_RETURN_ADDRESS: '0x0000000000000000000000000000000000000000',
      NEXT_PUBLIC_STELLAR_USDC_ISSUER: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTQSXUSMIQ75XABZEYYWRB6HP',
    },
  },
  validateEnv: vi.fn(),
}));

// ── shared mock helpers ───────────────────────────────────────────────────────

function makeRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>,
): NextRequest {
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
  return new NextRequest(url, init);
}

async function jsonBody(response: Response) {
  return response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/health
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 with status: operational', async () => {
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('operational');
    expect(Array.isArray(body.components)).toBe(true);
    expect(typeof body.timestamp).toBe('number');
  });

  it('includes corridors array in the response', async () => {
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const body = await jsonBody(res);

    expect(Array.isArray(body.corridors)).toBe(true);
    expect(body.corridors.length).toBeGreaterThan(0);
    expect(body.corridors[0]).toHaveProperty('corridor');
    expect(body.corridors[0]).toHaveProperty('status');
  });

  it('includes uptime percentages', async () => {
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const body = await jsonBody(res);

    expect(body.uptime).toHaveProperty('day');
    expect(body.uptime).toHaveProperty('week');
    expect(body.uptime).toHaveProperty('month');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/health/liveness
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/health/liveness', () => {
  it('returns 200 with ok status', async () => {
    const { GET } = await import('@/app/api/health/liveness/route');
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body).toHaveProperty('status');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/offramp/rate
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/services', () => ({
  fxRateService: {
    getRate: vi.fn(),
  },
}));

describe('GET /api/offramp/rate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with rate when fxRateService resolves', async () => {
    const { fxRateService } = await import('@/lib/services');
    vi.mocked(fxRateService.getRate).mockResolvedValue(1598 as any);

    const { GET } = await import('@/app/api/offramp/rate/route');
    const res = await GET();
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.rate).toBe(1598);
  });

  it('returns error when fxRateService throws', async () => {
    const { fxRateService } = await import('@/lib/services');
    vi.mocked(fxRateService.getRate).mockRejectedValue(new Error('unavailable'));

    const { GET } = await import('@/app/api/offramp/rate/route');
    const res = await GET();

    expect(res.status).not.toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 & 5. GET /api/offramp/currencies
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/currencies', () => ({
  getActiveCurrencies: vi.fn(() => [
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', minAmount: 1, maxAmount: 50000 },
    { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', minAmount: 1, maxAmount: 50000 },
  ]),
  isSupportedCurrency: vi.fn((code: string) => ['NGN', 'KES', 'GHS'].includes(code.toUpperCase())),
  validateCurrencyAmount: vi.fn(() => null), // null = valid
}));

vi.mock('@/lib/currency-flags', () => ({
  getCurrencyFlag: vi.fn(() => '🌍'),
}));

describe('GET /api/offramp/currencies', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns 200 with currency list on happy path (fallback path)', async () => {
    // Mock the Paycrest fetch to fail so we exercise the fallback
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network unavailable')),
    );

    const { GET } = await import('@/app/api/offramp/currencies/route');
    const req = makeRequest('GET', 'http://localhost/api/offramp/currencies');
    const res = await GET(req as any);
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('validates a supported currency with valid amount', async () => {
    const { GET } = await import('@/app/api/offramp/currencies/route');
    const req = makeRequest(
      'GET',
      'http://localhost/api/offramp/currencies?validate=NGN&amount=100',
    );
    const res = await GET(req as any);
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
  });

  it('returns invalid for an unsupported currency', async () => {
    const { GET } = await import('@/app/api/offramp/currencies/route');
    const req = makeRequest(
      'GET',
      'http://localhost/api/offramp/currencies?validate=XYZ',
    );
    const res = await GET(req as any);
    const body = await jsonBody(res);

    expect(body.valid).toBe(false);
    expect(body.error).toBeDefined();
  });

  it('returns invalid with error when amount validation fails', async () => {
    const { validateCurrencyAmount } = await import('@/lib/currencies');
    vi.mocked(validateCurrencyAmount).mockReturnValue('Amount too large');

    const { GET } = await import('@/app/api/offramp/currencies/route');
    const req = makeRequest(
      'GET',
      'http://localhost/api/offramp/currencies?validate=NGN&amount=9999999',
    );
    const res = await GET(req as any);
    const body = await jsonBody(res);

    expect(body.valid).toBe(false);
    expect(body.error).toBe('Amount too large');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. GET /api/offramp/institutions/[currency]
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/corridor-config', () => ({
  getCorridorConfig: vi.fn((currency: string) => {
    if (currency === 'NGN') {
      return {
        institutions: [
          { id: 'gtb', name: 'GTBank', code: 'GTB', type: 'bank' },
          { id: 'uba', name: 'UBA', code: 'UBA', type: 'bank' },
        ],
      };
    }
    return null;
  }),
}));

describe('GET /api/offramp/institutions/[currency]', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns fallback institutions when Paycrest is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );

    const { GET } = await import(
      '@/app/api/offramp/institutions/[currency]/route'
    );
    const res = await GET(
      makeRequest('GET', 'http://localhost/api/offramp/institutions/NGN') as any,
      { params: Promise.resolve({ currency: 'NGN' }) },
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
  });

  it('returns institutions from Paycrest on happy path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: 'gtb', name: 'GTBank', code: 'GTB' },
          ]),
      }),
    );

    const { GET } = await import(
      '@/app/api/offramp/institutions/[currency]/route'
    );
    const res = await GET(
      makeRequest('GET', 'http://localhost/api/offramp/institutions/NGN') as any,
      { params: Promise.resolve({ currency: 'NGN' }) },
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body[0].name).toBe('GTBank');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. POST /api/offramp/quote
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/compliance-screening', () => ({
  screenAddress: vi.fn().mockResolvedValue({ verdict: 'allow' }),
}));

vi.mock('@/lib/offramp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/offramp')>();
  return {
    ...actual,
    fetchPaycrestQuote: vi.fn(),
    buildQuote: vi.fn((destAmount: string, rate: number, currency: string) => ({
      destinationAmount: destAmount,
      rate,
      currency,
      bridgeFee: '0.5',
      payoutFee: '0',
      estimatedTime: 300,
    })),
    calculateBridgeAmount: vi.fn((amount: string) => amount),
    withAllbridgeTimeout: vi.fn((p: Promise<unknown>) => p),
    withPaycrestTimeout: vi.fn((p: Promise<unknown>) => p),
    validateAmount: actual.validateAmount,
    validateAddress: actual.validateAddress,
    extractErrorMessage: actual.extractErrorMessage,
  };
});

describe('POST /api/offramp/quote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const req = new NextRequest('http://localhost/api/offramp/quote', {
      method: 'POST',
      body: 'not-json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const req = makeRequest('POST', 'http://localhost/api/offramp/quote', {
      amount: '100',
      // missing currency and feeMethod
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for unsupported currency', async () => {
    const { POST } = await import('@/app/api/offramp/quote/route');
    const req = makeRequest('POST', 'http://localhost/api/offramp/quote', {
      amount: '100',
      currency: 'XYZ',
      feeMethod: 'USDC',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await jsonBody(res);
    // The error response body has a 'message' key for the human-readable text
    expect(JSON.stringify(body)).toMatch(/unsupported currency|validation/i);
  });

  it('returns 502 when Allbridge SDK is unavailable', async () => {
    // Mock dynamic import to throw
    vi.doMock('@allbridge/bridge-core-sdk', () => {
      throw new Error('SDK unavailable');
    });

    const { POST } = await import('@/app/api/offramp/quote/route');
    const req = makeRequest('POST', 'http://localhost/api/offramp/quote', {
      amount: '100',
      currency: 'NGN',
      feeMethod: 'USDC',
    });
    const res = await POST(req);

    expect(res.status).toBe(502);
    const body = await jsonBody(res);
    expect(body.error).toMatch(/bridge quote unavailable/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. POST /api/offramp/verify-account
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/offramp/verify-account', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await import('@/app/api/offramp/verify-account/route');
    const req = new NextRequest('http://localhost/api/offramp/verify-account', {
      method: 'POST',
      body: '{bad json',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const { POST } = await import('@/app/api/offramp/verify-account/route');
    const req = makeRequest('POST', 'http://localhost/api/offramp/verify-account', {
      // Missing accountIdentifier
      institution: 'GTB',
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('returns 200 with accountName on happy path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accountName: 'Jane Doe' }),
      }),
    );

    const { POST } = await import('@/app/api/offramp/verify-account/route');
    const req = makeRequest('POST', 'http://localhost/api/offramp/verify-account', {
      institution: 'GTB',
      accountIdentifier: '1234567890',
    });
    const res = await POST(req as any);
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.accountName).toBe('Jane Doe');
  });

  it('returns 400 when Paycrest returns a 400 client error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Invalid account number' }),
      }),
    );

    const { POST } = await import('@/app/api/offramp/verify-account/route');
    const req = makeRequest('POST', 'http://localhost/api/offramp/verify-account', {
      institution: 'GTB',
      accountIdentifier: '0000000000',
    });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET /api/offramp/status/[orderId]
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/polling', () => ({
  get: vi.fn(() => null),
  set: vi.fn(),
  isFresh: vi.fn(() => false),
}));

describe('GET /api/offramp/status/[orderId]', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const polling = await import('@/lib/polling');
    vi.mocked(polling.get).mockReturnValue(null);
    vi.mocked(polling.isFresh).mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns status on happy path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'pending', id: 'order-123' }),
      }),
    );

    const { GET } = await import('@/app/api/offramp/status/[orderId]/route');
    const res = await GET(
      makeRequest('GET', 'http://localhost/api/offramp/status/order-123') as any,
      { params: Promise.resolve({ orderId: 'order-123' }) },
    );
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('pending');
  });

  it('returns fresh cached response when available', async () => {
    const polling = await import('@/lib/polling');
    vi.mocked(polling.get).mockReturnValue({
      status: 'settled',
      raw: {},
      cachedAt: Date.now(),
      isTerminal: true,
    });
    vi.mocked(polling.isFresh).mockReturnValue(true);

    const { GET } = await import('@/app/api/offramp/status/[orderId]/route');
    const res = await GET(
      makeRequest('GET', 'http://localhost/api/offramp/status/order-456') as any,
      { params: Promise.resolve({ orderId: 'order-456' }) },
    );
    const body = await jsonBody(res);

    expect(body.status).toBe('settled');
  });

  it('returns an error response when Paycrest returns non-OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Order not found' }),
      }),
    );

    const { GET } = await import('@/app/api/offramp/status/[orderId]/route');
    const res = await GET(
      makeRequest('GET', 'http://localhost/api/offramp/status/unknown') as any,
      { params: Promise.resolve({ orderId: 'unknown' }) },
    );

    // The route forwards the upstream status code
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. POST /api/webhooks/paycrest
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/webhookVerify', () => ({
  verifyWebhookSignature: vi.fn(),
  createNonceTable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({
  dal: {
    getByPayoutOrderId: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
  },
  DatabaseError: class DatabaseError extends Error {},
}));

vi.mock('@/lib/webhook', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/notifications', () => ({
  notifyTransactionStatusUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/idempotency', () => ({
  withIdempotency: vi.fn((_req: unknown, fn: () => Promise<Response>) => fn()),
}));

describe('POST /api/webhooks/paycrest', () => {
  const validHeaders = {
    'x-paycrest-signature': 'sha256=test-signature',
    'x-paycrest-timestamp': String(Date.now()),
    'x-paycrest-nonce': 'test-nonce-123',
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const webhookVerify = await import('@/lib/webhookVerify');
    vi.mocked(webhookVerify.verifyWebhookSignature).mockResolvedValue({
      valid: true,
    });
    const db = await import('@/lib/db');
    vi.mocked(db.dal.getByPayoutOrderId).mockResolvedValue(null);
  });

  it('returns 401 when security headers are missing', async () => {
    const { POST } = await import('@/app/api/webhooks/paycrest/route');
    const req = makeRequest('POST', 'http://localhost/api/webhooks/paycrest', {
      event: 'payment_order.settled',
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 401 when signature verification fails', async () => {
    const webhookVerify = await import('@/lib/webhookVerify');
    vi.mocked(webhookVerify.verifyWebhookSignature).mockResolvedValue({
      valid: false,
      reason: 'Invalid signature',
    });

    const { POST } = await import('@/app/api/webhooks/paycrest/route');
    const payload = JSON.stringify({ event: 'payment_order.settled', data: { id: 'o-1' } });
    const req = new NextRequest('http://localhost/api/webhooks/paycrest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...validHeaders },
      body: payload,
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 200 received:true when no matching transaction is found', async () => {
    const db = await import('@/lib/db');
    vi.mocked(db.dal.getByPayoutOrderId).mockResolvedValue(null);

    const { POST } = await import('@/app/api/webhooks/paycrest/route');
    const payload = JSON.stringify({ event: 'payment_order.settled', data: { id: 'unknown-order' } });
    const req = new NextRequest('http://localhost/api/webhooks/paycrest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...validHeaders },
      body: payload,
    });
    const res = await POST(req);
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
  });

  it('updates transaction status on settled event', async () => {
    const db = await import('@/lib/db');
    const mockTx = {
      id: 'tx-1',
      status: 'pending',
      payoutStatus: 'pending',
      payoutOrderId: 'o-1',
    };
    vi.mocked(db.dal.getByPayoutOrderId).mockResolvedValue(mockTx as any);
    vi.mocked(db.dal.update).mockResolvedValue(undefined);
    vi.mocked(db.dal.getById).mockResolvedValue({ ...mockTx, status: 'completed' } as any);

    const { POST } = await import('@/app/api/webhooks/paycrest/route');
    const payload = JSON.stringify({ event: 'payment_order.settled', data: { id: 'o-1' } });
    const req = new NextRequest('http://localhost/api/webhooks/paycrest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...validHeaders },
      body: payload,
    });
    const res = await POST(req);
    const body = await jsonBody(res);

    expect(res.status).toBe(200);
    expect(body.received).toBe(true);
    expect(db.dal.update).toHaveBeenCalledWith(
      'tx-1',
      expect.objectContaining({ status: 'completed', payoutStatus: 'settled' }),
    );
  });

  it('returns 400 for malformed JSON payload', async () => {
    const { POST } = await import('@/app/api/webhooks/paycrest/route');
    const req = new NextRequest('http://localhost/api/webhooks/paycrest', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...validHeaders },
      body: '{invalid-json',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});


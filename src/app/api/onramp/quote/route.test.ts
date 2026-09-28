import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/cache', () => ({
  getCachedQuote: (
    _amount: string,
    _currency: string,
    _feeMethod: string,
    fetcher: () => Promise<unknown>,
  ) => fetcher(),
}));

const getQuoteMock = vi.fn(() => Promise.resolve({ destinationAmount: '100', rate: 1 }));
vi.mock('@/lib/di', () => ({
  globalContainer: { resolve: vi.fn(() => Promise.resolve({ getQuote: getQuoteMock })) },
  SERVICE_KEYS: { ONRAMP_SERVICE: 'ONRAMP_SERVICE' },
}));

import { POST } from './route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/onramp/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  fiatAmount: '100',
  fiatCurrency: 'NGN',
  destinationToken: 'USDC',
  destinationAddress: 'GA...DEST',
};

describe('POST /api/onramp/quote', () => {
  it('rejects a zero fiatAmount', async () => {
    const res = await POST(makeRequest({ ...validBody, fiatAmount: '0' }));
    expect(res.status).toBe(400);
  });

  it('rejects a non-numeric fiatAmount', async () => {
    const res = await POST(makeRequest({ ...validBody, fiatAmount: 'lots' }));
    expect(res.status).toBe(400);
  });

  it('rejects a missing destinationAddress', async () => {
    const { destinationAddress: _omit, ...rest } = validBody;
    const res = await POST(makeRequest(rest));
    expect(res.status).toBe(400);
  });

  it('rejects an unsupported currency', async () => {
    const res = await POST(makeRequest({ ...validBody, fiatCurrency: 'ZZZ' }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const req = new NextRequest('http://localhost/api/onramp/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not valid',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns a quote for a valid request', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.destinationAmount).toBe('100');
  });
});

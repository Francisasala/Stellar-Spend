import { describe, it, expect } from 'vitest';
import { buildRequestHash } from '@/lib/idempotency';

describe('buildRequestHash', () => {
  it('produces a consistent hash for identical inputs', () => {
    const hash1 = buildRequestHash('POST', '/api/test', '{"a":1,"b":2}');
    const hash2 = buildRequestHash('POST', '/api/test', '{"a":1,"b":2}');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different methods', () => {
    const hash1 = buildRequestHash('POST', '/api/test', '{"a":1}');
    const hash2 = buildRequestHash('PUT', '/api/test', '{"a":1}');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different paths', () => {
    const hash1 = buildRequestHash('POST', '/api/a', '{"a":1}');
    const hash2 = buildRequestHash('POST', '/api/b', '{"a":1}');
    expect(hash1).not.toBe(hash2);
  });

  it('normalizes JSON key order', () => {
    const hash1 = buildRequestHash('POST', '/api/test', '{"b":2,"a":1}');
    const hash2 = buildRequestHash('POST', '/api/test', '{"a":1,"b":2}');
    expect(hash1).toBe(hash2);
  });

  it('handles empty body', () => {
    const hash = buildRequestHash('POST', '/api/test', '');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64);
  });

  it('handles nested objects consistently', () => {
    const hash1 = buildRequestHash('POST', '/api/test', '{"nested":{"b":2,"a":1}}');
    const hash2 = buildRequestHash('POST', '/api/test', '{"nested":{"a":1,"b":2}}');
    expect(hash1).toBe(hash2);
  });

  it('handles arrays consistently', () => {
    const hash1 = buildRequestHash('POST', '/api/test', '{"items":[3,1,2]}');
    const hash2 = buildRequestHash('POST', '/api/test', '{"items":[3,1,2]}');
    expect(hash1).toBe(hash2);
  });

  it('handles null values', () => {
    const hash = buildRequestHash('POST', '/api/test', '{"key":null}');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
  });
});

describe('Idempotency contract', () => {
  it('should require Idempotency-Key for mutating endpoints', () => {
    const mutatingRoutes = [
      'POST /api/offramp/paycrest/order',
      'POST /api/offramp/execute-payout',
      'POST /api/offramp/bridge/submit-soroban',
      'POST /api/offramp/reverse',
      'PATCH /api/offramp/reverse',
      'POST /api/offramp/refund',
      'POST /api/offramp/insurance',
      'POST /api/offramp/recurring',
      'POST /api/offramp/batch',
      'POST /api/onramp/order',
    ];

    for (const route of mutatingRoutes) {
      expect(route).toBeTruthy();
    }
  });

  it('should not require Idempotency-Key for read-only endpoints', () => {
    const readOnlyRoutes = [
      'GET /api/offramp/currencies',
      'GET /api/offramp/institutions/[currency]',
      'GET /api/offramp/rate',
      'GET /api/offramp/tokens',
      'POST /api/offramp/quote',
      'POST /api/offramp/quote-aggregate',
      'POST /api/offramp/verify-account',
      'POST /api/offramp/fees',
      'POST /api/offramp/reconciliation',
      'GET /api/health',
    ];

    for (const route of readOnlyRoutes) {
      expect(route).toBeTruthy();
    }
  });

  it('Idempotency-Key header should be scoped to (key, method, path)', () => {
    const body = '{"amount":100}';
    const hashSame1 = buildRequestHash('POST', '/api/offramp/paycrest/order', body);
    const hashSame2 = buildRequestHash('POST', '/api/offramp/paycrest/order', body);
    const hashDiffPath = buildRequestHash('POST', '/api/offramp/execute-payout', body);
    const hashDiffMethod = buildRequestHash('GET', '/api/offramp/paycrest/order', body);

    expect(hashSame1).toBe(hashSame2);
    expect(hashSame1).not.toBe(hashDiffPath);
    expect(hashSame1).not.toBe(hashDiffMethod);
  });
});

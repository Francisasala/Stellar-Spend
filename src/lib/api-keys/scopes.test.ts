import { describe, expect, it } from 'vitest';
import { getRequiredScope, hasRequiredScope, SCOPE_CATALOG } from './scopes';
import type { ApiKeyRecord } from './types';

function makeKey(scopes: string[]): ApiKeyRecord {
  return {
    id: 'test-key',
    name: 'Test Key',
    keyPrefix: 'test',
    status: 'active',
    scopes: scopes as ApiKeyRecord['scopes'],
    rateLimitMaxRequests: 60,
    rateLimitWindowMs: 60000,
    usageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('Scope Catalog', () => {
  it('contains all expected scope definitions', () => {
    expect(SCOPE_CATALOG['admin:*']).toBeDefined();
    expect(SCOPE_CATALOG['read:quotes']).toBeDefined();
    expect(SCOPE_CATALOG['write:payouts']).toBeDefined();
    expect(SCOPE_CATALOG['read:transactions']).toBeDefined();
    expect(SCOPE_CATALOG['write:transactions']).toBeDefined();
  });
});

describe('getRequiredScope', () => {
  it('returns read:quotes for GET /api/v1/offramp/quote', () => {
    expect(getRequiredScope('GET', '/api/v1/offramp/quote')).toBe('read:quotes');
  });

  it('returns write:payouts for POST /api/v1/offramp/execute-payout', () => {
    expect(getRequiredScope('POST', '/api/v1/offramp/execute-payout')).toBe('write:payouts');
  });

  it('returns null for unregistered paths', () => {
    expect(getRequiredScope('GET', '/api/health')).toBeNull();
  });

  it('returns read:transactions for GET /api/transactions', () => {
    expect(getRequiredScope('GET', '/api/transactions')).toBe('read:transactions');
  });

  it('returns write:transactions for POST /api/transactions', () => {
    expect(getRequiredScope('POST', '/api/transactions')).toBe('write:transactions');
  });
});

describe('hasRequiredScope', () => {
  it('allows access when key has admin:*', () => {
    const key = makeKey(['admin:*']);
    expect(hasRequiredScope(key, 'read:quotes')).toBe(true);
    expect(hasRequiredScope(key, 'write:payouts')).toBe(true);
    expect(hasRequiredScope(key, 'read:transactions')).toBe(true);
  });

  it('allows access when key has the exact required scope', () => {
    const key = makeKey(['read:quotes']);
    expect(hasRequiredScope(key, 'read:quotes')).toBe(true);
  });

  it('denies access when key lacks the required scope', () => {
    const key = makeKey(['read:transactions']);
    expect(hasRequiredScope(key, 'read:quotes')).toBe(false);
    expect(hasRequiredScope(key, 'write:payouts')).toBe(false);
  });

  it('allows access with multiple scopes', () => {
    const key = makeKey(['read:quotes', 'write:payouts']);
    expect(hasRequiredScope(key, 'read:quotes')).toBe(true);
    expect(hasRequiredScope(key, 'write:payouts')).toBe(true);
    expect(hasRequiredScope(key, 'read:transactions')).toBe(false);
  });

  it('handles empty scopes', () => {
    const key = makeKey([]);
    expect(hasRequiredScope(key, 'read:quotes')).toBe(false);
  });

  it('recognizes legacy admin scope', () => {
    const key = makeKey(['admin']);
    expect(hasRequiredScope(key, 'read:quotes')).toBe(true);
    expect(hasRequiredScope(key, 'write:payouts')).toBe(true);
  });
});

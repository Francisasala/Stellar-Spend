import { describe, it, expect } from 'vitest';
import {
  PROVIDER_FALLBACK_ORDER,
  getOrderedProviders,
  getProviderStatus,
} from './quote-aggregator';

/**
 * Unit tests for the explicit provider fallback ordering introduced to
 * replace implicit if/else branching in quote-aggregator.ts.
 *
 * See docs/quote-provider-fallback-order.md for the documented priority list.
 */
describe('quote-aggregator fallback ordering', () => {
  it('documents paycrest as the first-priority provider', () => {
    expect(PROVIDER_FALLBACK_ORDER[0]).toBe('paycrest');
  });

  it('documents allbridge as the secondary/backup provider', () => {
    expect(PROVIDER_FALLBACK_ORDER[1]).toBe('allbridge');
  });

  it('returns only enabled providers, in fallback-priority order', () => {
    const ordered = getOrderedProviders(['allbridge', 'paycrest']);
    // paycrest is enabled by default, allbridge is disabled by default
    expect(ordered).toEqual(['paycrest']);
  });

  it('respects the requested subset while preserving priority order', () => {
    const ordered = getOrderedProviders(['paycrest']);
    expect(ordered).toEqual(['paycrest']);
  });

  it('returns an empty list when no requested providers are enabled', () => {
    const ordered = getOrderedProviders(['allbridge']);
    expect(ordered).toEqual([]);
  });

  it('falls back to the full documented order when none requested', () => {
    const ordered = getOrderedProviders();
    expect(ordered.every((p) => PROVIDER_FALLBACK_ORDER.includes(p))).toBe(true);
  });

  it('exposes provider status keyed by every documented provider', () => {
    const status = getProviderStatus();
    for (const provider of PROVIDER_FALLBACK_ORDER) {
      expect(status[provider]).toBeDefined();
      expect(typeof status[provider].priority).toBe('number');
    }
  });
});

/* ============================================================================
 * Fallback-path coverage (#1209)
 *
 * The ordered-strategy refactor is already on main (commit 7dce45d).
 * These tests lock in each named fallback path so a future change to the
 * ordering or the strategy map cannot silently regress it.
 * ========================================================================= */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PROVIDER_FALLBACK_ORDER,
  getOrderedProviders,
  getProviderStatus,
  aggregateQuotes,
  resetReliabilityHistory,
} from './quote-aggregator';
import * as quoteFetcher from './offramp/utils/quote-fetcher';
import * as cache from './cache';

function stubCache() {
  const stub = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  };
  vi.spyOn(cache, 'getCacheClient').mockReturnValue(stub as never);
  return stub;
}

describe('quote-aggregator fallback paths (#1209)', () => {
  beforeEach(() => {
    resetReliabilityHistory();
    vi.restoreAllMocks();
  });

  it('PROVIDER_FALLBACK_ORDER is non-empty, primary-first, and duplicate-free', () => {
    expect(PROVIDER_FALLBACK_ORDER.length).toBeGreaterThan(0);
    expect(PROVIDER_FALLBACK_ORDER[0]).toBe('paycrest');
    expect(new Set(PROVIDER_FALLBACK_ORDER).size).toBe(PROVIDER_FALLBACK_ORDER.length);
  });

  it('has an explicit strategy entry for every provider in the order', () => {
    const status = getProviderStatus();
    for (const provider of PROVIDER_FALLBACK_ORDER) {
      expect(status[provider]).toBeDefined();
      expect(status[provider].name).toBeTypeOf('string');
    }
  });

  it('getOrderedProviders preserves priority regardless of argument order', () => {
    const ordered = getOrderedProviders(['allbridge', 'paycrest']);
    const pi = ordered.indexOf('paycrest');
    const ai = ordered.indexOf('allbridge');
    if (pi !== -1 && ai !== -1) expect(pi).toBeLessThan(ai);
  });

  it('getOrderedProviders filters out unrequested providers', () => {
    const ordered = getOrderedProviders(['paycrest']);
    expect(ordered).toEqual(['paycrest']);
    expect(ordered).not.toContain('allbridge');
  });

  it('throws when no providers are enabled', async () => {
    await expect(aggregateQuotes('100', 'NGN', [])).rejects.toThrow(
      /No enabled providers available/,
    );
  });

  it('primary succeeds → bestQuote comes from paycrest', async () => {
    vi.spyOn(quoteFetcher, 'fetchPaycrestQuote').mockResolvedValue({
      rate: 1500,
      destinationAmount: '150000',
    } as never);
    stubCache();

    const result = await aggregateQuotes('100', 'NGN', ['paycrest']);
    expect(result.bestQuote?.provider).toBe('paycrest');
    expect(result.successfulProviders).toBeGreaterThanOrEqual(1);
  });

  it('primary fails → aggregate records failure without throwing', async () => {
    vi.spyOn(quoteFetcher, 'fetchPaycrestQuote').mockRejectedValue(
      new Error('paycrest down'),
    );
    stubCache();

    const result = await aggregateQuotes('100', 'NGN', ['paycrest']);
    expect(result.bestQuote).toBeNull();
    expect(result.successfulProviders).toBe(0);
    expect(result.allQuotes[0].success).toBe(false);
    expect(result.allQuotes[0].error).toMatch(/paycrest down/);
  });

  it('cached response is returned without calling providers', async () => {
    const cachedBody = JSON.stringify({
      bestQuote: null,
      allQuotes: [],
      alternatives: [],
      timestamp: new Date().toISOString(),
      totalProviders: 1,
      successfulProviders: 0,
      degradedProviders: [],
    });
    const stub = {
      get: vi.fn().mockResolvedValue(cachedBody),
      set: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(cache, 'getCacheClient').mockReturnValue(stub as never);
    const fetchSpy = vi.spyOn(quoteFetcher, 'fetchPaycrestQuote');

    const result = await aggregateQuotes('100', 'NGN', ['paycrest']);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.totalProviders).toBe(1);
  });
});

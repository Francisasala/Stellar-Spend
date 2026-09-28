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

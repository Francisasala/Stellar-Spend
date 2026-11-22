/**
 * Per-route rate limit lookup (#1461).
 */

import { describe, it, expect } from 'vitest';
import {
  getRouteRateLimitConfig,
  PUBLIC_API_RATE_LIMITS,
} from './public-api-rate-limit.middleware';

describe('getRouteRateLimitConfig (#1461)', () => {
  it('returns the configured limit for an exact route match', () => {
    expect(getRouteRateLimitConfig('/api/auth/login')).toEqual(
      PUBLIC_API_RATE_LIMITS['/api/auth/login'],
    );
    expect(getRouteRateLimitConfig('/api/auth/login')).toEqual({
      maxRequests: 5,
      windowMs: 60_000,
    });
  });

  it('returns null for a route with no configured limit', () => {
    expect(getRouteRateLimitConfig('/api/not-a-configured-route')).toBeNull();
  });

  it('gives login a stricter limit than quote', () => {
    const login = getRouteRateLimitConfig('/api/auth/login');
    const quote = getRouteRateLimitConfig('/api/offramp/quote');

    expect(login!.maxRequests).toBeLessThan(quote!.maxRequests);
  });
});

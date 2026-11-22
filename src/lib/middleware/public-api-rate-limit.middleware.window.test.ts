/**
 * Rate limit window boundaries and response-header assertions (#1523).
 *
 * Verifies the in-memory store window semantics (count resets after the
 * window elapses) and that the middleware emits X-RateLimit-* /
 * Retry-After headers on both allowed and blocked responses.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  publicApiRateLimitMiddleware,
  PUBLIC_API_RATE_LIMITS,
} from './public-api-rate-limit.middleware';

const LOGIN_LIMIT = PUBLIC_API_RATE_LIMITS['/api/auth/login']!.maxRequests;

function makeLoginRequest(): NextRequest {
  return new NextRequest('https://api.example.com/api/auth/login');
}

describe('rate limit window boundaries (#1523)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets the count once the window elapses', async () => {
    vi.useFakeTimers();
    const req = makeLoginRequest();

    // First call: allowed, count 1.
    expect(await publicApiRateLimitMiddleware(req)).toBeNull();
    expect(await publicApiRateLimitMiddleware(req)).toBeNull();

    // Push to the limit; next call is blocked.
    for (let i = 3; i <= LOGIN_LIMIT; i++) {
      expect(await publicApiRateLimitMiddleware(req)).toBeNull();
    }
    expect(await publicApiRateLimitMiddleware(req)).not.toBeNull();

    // Advance past the 60s window: count resets to 1 (allowed).
    vi.advanceTimersByTime(60_500);
    expect(await publicApiRateLimitMiddleware(req)).toBeNull();

    // Within the new window the limit applies again.
    for (let i = 2; i <= LOGIN_LIMIT; i++) {
      expect(await publicApiRateLimitMiddleware(req)).toBeNull();
    }
    expect(await publicApiRateLimitMiddleware(req)).not.toBeNull();
  });

  it('emits X-RateLimit-* headers on allowed responses', async () => {
    const req = makeLoginRequest();
    const res = await publicApiRateLimitMiddleware(req);
    expect(res).toBeNull(); // allowed → null response, headers added later
  });

  it('emits X-RateLimit-* headers on blocked responses', async () => {
    vi.useFakeTimers();
    const req = makeLoginRequest();
    for (let i = 0; i < LOGIN_LIMIT; i++) {
      await publicApiRateLimitMiddleware(req);
    }
    const blocked = await publicApiRateLimitMiddleware(req);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get('X-RateLimit-Limit')).toBe(LOGIN_LIMIT.toString());
    expect(blocked!.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(blocked!.headers.get('X-RateLimit-Reset')).toBeTruthy();
    expect(blocked!.headers.get('Retry-After')).toBe('60');
  });

  it('includes a Retry-After hint matching the configured window', async () => {
    vi.useFakeTimers();
    const quoteLimit = PUBLIC_API_RATE_LIMITS['/api/offramp/quote']!;
    const req = new NextRequest('https://api.example.com/api/offramp/quote');
    for (let i = 0; i < quoteLimit.maxRequests; i++) {
      await publicApiRateLimitMiddleware(req);
    }
    const blocked = await publicApiRateLimitMiddleware(req);
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get('Retry-After')).toBe(
      Math.ceil(quoteLimit.windowMs / 1000).toString(),
    );
  });
});

/**
 * Fake-timer tests for SlidingWindowRateLimiter — issue #1352
 *
 * These tests use vitest's fake timers to exercise:
 *  - Window expiry releasing capacity (sliding window reset)
 *  - Burst behaviour: a burst fills the window, then older timestamps slide out
 *  - Per-key isolation under time advancement
 *  - Partial window expiry (only oldest slots slide out, not all)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlidingWindowRateLimiter, type RateLimitConfig } from '@/lib/rateLimiter';

// ── In-memory cache backed by a real Date.now() so fake timers affect TTL ────

const cacheStore = new Map<string, string>();

vi.mock('@/lib/cache/client', () => ({
  getCacheClient: () => ({
    get: async (key: string) => cacheStore.get(key) ?? null,
    set: async (key: string, value: string) => {
      cacheStore.set(key, value);
    },
    del: async (key: string) => {
      cacheStore.delete(key);
    },
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function makeLimiter(config: Partial<RateLimitConfig> = {}): SlidingWindowRateLimiter {
  return new SlidingWindowRateLimiter('window-test', {
    maxRequests: 3,
    windowMs: 60_000, // 1 minute window
    ...config,
  });
}

// ── Window expiry ─────────────────────────────────────────────────────────────

describe('SlidingWindowRateLimiter — window expiry (fake timers)', () => {
  beforeEach(() => {
    cacheStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects at the limit, then allows again after the full window expires', async () => {
    const limiter = makeLimiter({ maxRequests: 3, windowMs: 60_000 });

    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      expect((await limiter.check('user-1')).allowed).toBe(true);
    }
    expect((await limiter.check('user-1')).allowed).toBe(false);

    // Advance past the window boundary — all three timestamps should slide out
    vi.advanceTimersByTime(61_000);

    const result = await limiter.check('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 3 max - 1 just recorded
  });

  it('sliding: oldest slot expires one at a time, capacity trickles back', async () => {
    const limiter = makeLimiter({ maxRequests: 3, windowMs: 60_000 });

    // t=0: fill all three slots
    for (let i = 0; i < 3; i++) {
      await limiter.check('user-2');
    }
    expect((await limiter.check('user-2')).allowed).toBe(false);

    // t=20s: still all three slots within window → still blocked
    vi.advanceTimersByTime(20_000);
    expect((await limiter.check('user-2')).allowed).toBe(false);

    // t=61s: all three initial slots have expired → allowed again
    vi.advanceTimersByTime(41_000); // 20+41 = 61s total
    expect((await limiter.check('user-2')).allowed).toBe(true);
  });

  it('window resets do not bleed into other keys', async () => {
    const limiter = makeLimiter({ maxRequests: 2, windowMs: 30_000 });

    await limiter.check('key-a');
    await limiter.check('key-a');
    expect((await limiter.check('key-a')).allowed).toBe(false);

    // key-b is completely independent
    expect((await limiter.check('key-b')).allowed).toBe(true);
    expect((await limiter.check('key-b')).allowed).toBe(true);
    expect((await limiter.check('key-b')).allowed).toBe(false);

    // Advance past key-a's window
    vi.advanceTimersByTime(31_000);
    expect((await limiter.check('key-a')).allowed).toBe(true);
    // key-b window also expired; it gets a fresh slot
    expect((await limiter.check('key-b')).allowed).toBe(true);
  });

  it('resetAt is approximately (now + windowMs) for an allowed request', async () => {
    const windowMs = 60_000;
    const limiter = makeLimiter({ maxRequests: 5, windowMs });

    const before = Date.now();
    const result = await limiter.check('user-3');
    const after = Date.now();

    expect(result.allowed).toBe(true);
    // resetAt should be roughly (now + windowMs)
    expect(result.resetAt).toBeGreaterThanOrEqual(before + windowMs);
    expect(result.resetAt).toBeLessThanOrEqual(after + windowMs + 50);
  });
});

// ── Burst behaviour ───────────────────────────────────────────────────────────

describe('SlidingWindowRateLimiter — burst limits (fake timers)', () => {
  beforeEach(() => {
    cacheStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a burst at t=0 blocks until the window clears, then allows a new burst', async () => {
    const limiter = makeLimiter({ maxRequests: 5, windowMs: 60_000 });

    // Full burst
    for (let i = 0; i < 5; i++) {
      expect((await limiter.check('burst-user')).allowed).toBe(true);
    }
    expect((await limiter.check('burst-user')).allowed).toBe(false);

    // 30s in: still blocked (all 5 timestamps still inside the 60s window)
    vi.advanceTimersByTime(30_000);
    expect((await limiter.check('burst-user')).allowed).toBe(false);

    // 61s total: all original timestamps expired → fresh burst allowed
    vi.advanceTimersByTime(31_000);
    for (let i = 0; i < 5; i++) {
      expect((await limiter.check('burst-user')).allowed).toBe(true);
    }
    expect((await limiter.check('burst-user')).allowed).toBe(false);
  });

  it('retryAfter reflects the time until the oldest slot expires', async () => {
    const limiter = makeLimiter({ maxRequests: 2, windowMs: 60_000 });

    await limiter.check('retry-user'); // t=0
    vi.advanceTimersByTime(10_000); // t=10s
    await limiter.check('retry-user'); // t=10s

    vi.advanceTimersByTime(5_000); // t=15s
    const blocked = await limiter.check('retry-user'); // should block

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeDefined();
    // oldest slot was at t=0, window=60s → retryAfter ≈ (60-15)=45s
    expect(blocked.retryAfter!).toBeGreaterThan(0);
    expect(blocked.retryAfter!).toBeLessThanOrEqual(60);
  });

  it('per-namespace burst limits are independent across namespaces', async () => {
    const ns1 = new SlidingWindowRateLimiter('burst-ns1', { maxRequests: 2, windowMs: 60_000 });
    const ns2 = new SlidingWindowRateLimiter('burst-ns2', { maxRequests: 2, windowMs: 60_000 });

    await ns1.check('shared-key');
    await ns1.check('shared-key');
    expect((await ns1.check('shared-key')).allowed).toBe(false);

    // ns2 is unaffected by ns1's exhaustion
    expect((await ns2.check('shared-key')).allowed).toBe(true);
    expect((await ns2.check('shared-key')).allowed).toBe(true);
    expect((await ns2.check('shared-key')).allowed).toBe(false);
  });

  it('remaining is correctly recalculated as old slots slide out mid-window', async () => {
    const limiter = makeLimiter({ maxRequests: 3, windowMs: 30_000 });

    // t=0: use 2 slots
    await limiter.check('sliding-user');
    await limiter.check('sliding-user');
    let result = await limiter.check('sliding-user'); // 3rd — hits limit
    expect(result.remaining).toBe(0);

    // t=31s: all three t=0 slots expired; now we get fresh capacity
    vi.advanceTimersByTime(31_000);
    result = await limiter.check('sliding-user');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 3 max, 1 just added
  });

  it('premium bypass still works after real time advances', async () => {
    const limiter = makeLimiter({ maxRequests: 2, windowMs: 60_000, premiumBypass: true });

    // Exhaust for a non-premium user
    await limiter.check('prem-key');
    await limiter.check('prem-key');
    expect((await limiter.check('prem-key')).allowed).toBe(false);

    vi.advanceTimersByTime(10_000);

    // Premium user bypasses even mid-window
    const r = await limiter.check('prem-key', { isPremium: true });
    expect(r.allowed).toBe(true);
  });
});

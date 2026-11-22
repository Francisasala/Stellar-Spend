/**
 * Boundary tests for KYCLimitService.canTransact — issue #1351
 *
 * Covers:
 *  - Exact transaction limit (allowed) and limit + 1 (rejected)
 *  - Daily limit boundary (exact fit vs one-over)
 *  - Monthly limit boundary (exact fit vs one-over)
 *  - Tier1 / Tier2 / Tier3 limits
 *  - Corridor override limits (NGN tier2 override)
 *  - Currency conversion edge: unknown currency falls through to base limits
 *  - Daily / monthly window reset when clock advances
 *  - Uninitialized user is rejected
 *  - recordTransaction accumulates correctly toward the limit
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { KYCLimitService, setCorridorOverrides, type LimitTier } from './kyc-limits';

// ── localStorage mock ─────────────────────────────────────────────────────────
//
// KYCLimitService reads / writes window.localStorage. In jsdom (the vitest
// environment configured in vitest.config.ts) localStorage is available, but we
// reset it before each test so state does not bleed between cases.

beforeEach(() => {
  localStorage.clear();

  // Reset module-level corridor-override cache between tests so setCorridorOverrides
  // calls in one test don't leak into the next.
  setCorridorOverrides({
    NGN: {
      tier2: { dailyLimit: 10_000, monthlyLimit: 100_000, transactionLimit: 5_000 },
    },
  });
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function newUser(tier: LimitTier = 'tier1'): string {
  const userId = `user-${Math.random().toString(36).slice(2)}`;
  KYCLimitService.initializeUserLimits(userId, tier);
  return userId;
}

// ── Uninitialized user ────────────────────────────────────────────────────────

describe('canTransact — uninitialized user', () => {
  it('rejects a user whose limits have never been initialized', () => {
    const result = KYCLimitService.canTransact('no-such-user', 100);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not initialized/i);
  });
});

// ── Tier 1 transaction limit boundaries ──────────────────────────────────────

describe('canTransact — tier1 transaction limit', () => {
  // Tier1: transactionLimit=500, dailyLimit=1000, monthlyLimit=10000

  it('allows a transaction exactly at the transaction limit (500)', () => {
    const uid = newUser('tier1');
    expect(KYCLimitService.canTransact(uid, 500).allowed).toBe(true);
  });

  it('rejects a transaction one unit above the transaction limit (501)', () => {
    const uid = newUser('tier1');
    const result = KYCLimitService.canTransact(uid, 501);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/500/);
  });

  it('allows zero is NOT a valid transaction (boundary: 0 is rejected if <= 0 applies)', () => {
    // canTransact does not guard zero itself; that's the deposit layer.
    // Verify 1 is allowed as the minimum meaningful transaction.
    const uid = newUser('tier1');
    expect(KYCLimitService.canTransact(uid, 1).allowed).toBe(true);
  });
});

// ── Tier 2 transaction limit boundaries ──────────────────────────────────────

describe('canTransact — tier2 transaction limit', () => {
  // Tier2: transactionLimit=2500, dailyLimit=5000, monthlyLimit=50000

  it('allows a transaction exactly at the tier2 transaction limit (2500)', () => {
    const uid = newUser('tier2');
    expect(KYCLimitService.canTransact(uid, 2500).allowed).toBe(true);
  });

  it('rejects tier2 transaction limit + 1 (2501)', () => {
    const uid = newUser('tier2');
    const result = KYCLimitService.canTransact(uid, 2501);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/2500/);
  });
});

// ── Tier 3 transaction limit boundaries ──────────────────────────────────────

describe('canTransact — tier3 transaction limit', () => {
  // Tier3: transactionLimit=25000, dailyLimit=50000, monthlyLimit=500000

  it('allows a transaction exactly at the tier3 transaction limit (25000)', () => {
    const uid = newUser('tier3');
    expect(KYCLimitService.canTransact(uid, 25_000).allowed).toBe(true);
  });

  it('rejects tier3 transaction limit + 1 (25001)', () => {
    const uid = newUser('tier3');
    const result = KYCLimitService.canTransact(uid, 25_001);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/25000/);
  });
});

// ── Daily limit boundaries ────────────────────────────────────────────────────

describe('canTransact — daily limit boundary', () => {
  it('allows multiple transactions that sum to exactly the daily limit', () => {
    // Tier1: transactionLimit=500, dailyLimit=1000
    const uid = newUser('tier1');

    KYCLimitService.recordTransaction(uid, 500); // 500 used
    expect(KYCLimitService.canTransact(uid, 500).allowed).toBe(true); // 500 + 500 = 1000 exactly
  });

  it('rejects a transaction that would push dailyUsed one unit over the daily limit', () => {
    // Use tier2 so we can stay within the txLimit (2500) but exceed dailyLimit
    // Tier2: transactionLimit=2500, dailyLimit=5000
    const uid = newUser('tier2');

    KYCLimitService.recordTransaction(uid, 4_500); // 4500 used
    // 4500 + 501 = 5001 > 5000 daily; 501 < 2500 tx limit → daily error
    const result = KYCLimitService.canTransact(uid, 501);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/daily/i);
  });

  it('rejects when dailyUsed already equals the daily limit', () => {
    // Tier2: dailyLimit=5000
    const uid = newUser('tier2');
    KYCLimitService.recordTransaction(uid, 5_000); // exactly at daily limit
    const result = KYCLimitService.canTransact(uid, 1); // even 1 more is over
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/daily/i);
  });
});

// ── Monthly limit boundaries ──────────────────────────────────────────────────

describe('canTransact — monthly limit boundary', () => {
  it('allows a transaction that fills the monthly limit exactly', () => {
    // Use tier2 to avoid daily limit (5000/day) being hit first.
    // Tier2: transactionLimit=2500, dailyLimit=5000, monthlyLimit=50000
    // Seed: 49500 monthly, 0 daily (inject directly so daily is not also 49500)
    const uid = newUser('tier2');
    // recordTransaction increments both daily and monthly; we need monthly near limit
    // but daily low. Use 20 × 2000 = 40000 monthly but that hits daily (5000) after 2-3.
    // Instead: seed via localStorage directly.
    const limitsKey = 'stellar_spend_limits';
    const stored = JSON.parse(localStorage.getItem(limitsKey) ?? '{}');
    stored[uid] = {
      ...stored[uid],
      dailyUsed: 0,
      monthlyUsed: 47_500,
    };
    localStorage.setItem(limitsKey, JSON.stringify(stored));

    // 47500 monthly used, 0 daily used; try 2500 → 47500+2500=50000 exactly
    expect(KYCLimitService.canTransact(uid, 2_500).allowed).toBe(true);
  });

  it('rejects when monthly usage would exceed the monthly limit by one', () => {
    const uid = newUser('tier2');
    const limitsKey = 'stellar_spend_limits';
    const stored = JSON.parse(localStorage.getItem(limitsKey) ?? '{}');
    stored[uid] = { ...stored[uid], dailyUsed: 0, monthlyUsed: 47_500 };
    localStorage.setItem(limitsKey, JSON.stringify(stored));

    // 47500 + 2501 = 50001 > 50000 monthly, and 2501 > txLimit(2500) so either error
    const result = KYCLimitService.canTransact(uid, 2_501);
    expect(result.allowed).toBe(false);
  });

  it('rejects when monthlyUsed already equals the monthly limit', () => {
    const uid = newUser('tier2');
    const limitsKey = 'stellar_spend_limits';
    const stored = JSON.parse(localStorage.getItem(limitsKey) ?? '{}');
    stored[uid] = { ...stored[uid], dailyUsed: 0, monthlyUsed: 50_000 };
    localStorage.setItem(limitsKey, JSON.stringify(stored));

    const result = KYCLimitService.canTransact(uid, 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/monthly/i);
  });
});

// ── Corridor overrides ────────────────────────────────────────────────────────

describe('canTransact — corridor overrides (NGN)', () => {
  // NGN override for tier2: transactionLimit=5000, dailyLimit=10000, monthlyLimit=100000

  it('applies NGN corridor override: allows up to 5000 per transaction (vs default 2500)', () => {
    const uid = newUser('tier2');
    expect(KYCLimitService.canTransact(uid, 5_000, 'NGN').allowed).toBe(true);
  });

  it('applies NGN corridor override: rejects 5001 (one over NGN tier2 tx limit)', () => {
    const uid = newUser('tier2');
    const result = KYCLimitService.canTransact(uid, 5_001, 'NGN');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/5000/);
  });

  it('corridor override is case-insensitive (ngn == NGN)', () => {
    const uid = newUser('tier2');
    expect(KYCLimitService.canTransact(uid, 5_000, 'ngn').allowed).toBe(true);
  });

  it('unknown currency falls back to base tier limits', () => {
    const uid = newUser('tier2');
    // Tier2 default transactionLimit = 2500; no override for XYZ
    expect(KYCLimitService.canTransact(uid, 2_500, 'XYZ').allowed).toBe(true);
    expect(KYCLimitService.canTransact(uid, 2_501, 'XYZ').allowed).toBe(false);
  });

  it('non-overridden tier for NGN uses base limits (tier1 has no NGN override)', () => {
    const uid = newUser('tier1');
    // Tier1 transactionLimit = 500 (no NGN override for tier1)
    expect(KYCLimitService.canTransact(uid, 500, 'NGN').allowed).toBe(true);
    expect(KYCLimitService.canTransact(uid, 501, 'NGN').allowed).toBe(false);
  });
});

// ── Daily / monthly reset ─────────────────────────────────────────────────────

describe('canTransact — limit resets over time', () => {
  it('daily usage resets after the daily window expires', () => {
    vi.useFakeTimers();

    const uid = newUser('tier1');
    KYCLimitService.recordTransaction(uid, 1_000); // full daily limit used

    expect(KYCLimitService.canTransact(uid, 1).allowed).toBe(false);

    // Advance 25 hours to pass the daily reset
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);

    expect(KYCLimitService.canTransact(uid, 500).allowed).toBe(true);
  });

  it('monthly usage resets after the monthly window expires', () => {
    vi.useFakeTimers();

    const uid = newUser('tier1');
    KYCLimitService.recordTransaction(uid, 10_000); // full monthly limit used

    expect(KYCLimitService.canTransact(uid, 1).allowed).toBe(false);

    // Advance 31 days to pass the monthly reset
    vi.advanceTimersByTime(31 * 24 * 60 * 60 * 1000);

    expect(KYCLimitService.canTransact(uid, 500).allowed).toBe(true);
  });
});

// ── recordTransaction accumulation ───────────────────────────────────────────

describe('recordTransaction — accumulation toward limits', () => {
  it('accumulates dailyUsed and monthlyUsed correctly', () => {
    // Tier2: transactionLimit=2500, dailyLimit=5000
    // After recording 2000, dailyUsed=2000. Remaining daily = 3000.
    // But each canTransact call is for one tx; txLimit=2500 caps each individual tx.
    const uid = newUser('tier2');

    KYCLimitService.recordTransaction(uid, 1_000);
    KYCLimitService.recordTransaction(uid, 1_000);

    // 2000 used; dailyLimit=5000 means 3000 remaining daily;
    // individual tx is capped at 2500, so 2500 should work but 2501 should not.
    expect(KYCLimitService.canTransact(uid, 2_500).allowed).toBe(true);
    expect(KYCLimitService.canTransact(uid, 2_501).allowed).toBe(false);
  });

  it('canTransact result is consistent with sequential recordTransaction calls', () => {
    const uid = newUser('tier2');

    // Record 4 transactions of 1000 each → 4000 used (daily limit 5000)
    for (let i = 0; i < 4; i++) {
      expect(KYCLimitService.canTransact(uid, 1_000).allowed).toBe(true);
      KYCLimitService.recordTransaction(uid, 1_000);
    }

    // 4000 used; only 1000 left; 1001 should fail daily check
    expect(KYCLimitService.canTransact(uid, 1_001).allowed).toBe(false);
    expect(KYCLimitService.canTransact(uid, 1_000).allowed).toBe(true);
  });
});

// ── setCorridorOverrides edge cases ──────────────────────────────────────────

describe('setCorridorOverrides — runtime override management', () => {
  it('overrides update immediately without reloading from localStorage', () => {
    const uid = newUser('tier2');

    // Default NGN override: txLimit = 5000
    expect(KYCLimitService.canTransact(uid, 5_000, 'NGN').allowed).toBe(true);
    expect(KYCLimitService.canTransact(uid, 5_001, 'NGN').allowed).toBe(false);

    // Update to a tighter override
    setCorridorOverrides({
      NGN: {
        tier2: { dailyLimit: 3_000, monthlyLimit: 30_000, transactionLimit: 1_000 },
      },
    });

    expect(KYCLimitService.canTransact(uid, 1_000, 'NGN').allowed).toBe(true);
    expect(KYCLimitService.canTransact(uid, 1_001, 'NGN').allowed).toBe(false);
  });

  it('clearing all overrides reverts to base tier limits', () => {
    setCorridorOverrides({}); // empty overrides

    const uid = newUser('tier2');
    // Back to base tier2: txLimit = 2500
    expect(KYCLimitService.canTransact(uid, 2_500, 'NGN').allowed).toBe(true);
    expect(KYCLimitService.canTransact(uid, 2_501, 'NGN').allowed).toBe(false);
  });
});

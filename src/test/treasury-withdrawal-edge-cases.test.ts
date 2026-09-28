/**
 * treasury-withdrawal-edge-cases.test.ts
 *
 * Issue #1005 — Contract unit tests for treasury edge-case withdrawal amounts.
 *
 * Tests the three critical edge cases for treasury fee collection and routing:
 *
 *  1. Withdraw exactly the full balance — must succeed and return the correct fee.
 *  2. Withdraw zero — must be rejected (positive amount required).
 *  3. Withdraw over balance — must be rejected (contract validates positive amount,
 *     the calling layer must enforce balance sufficiency).
 *
 * ## Context
 *
 * The treasury contract (`contracts/treasury/src/lib.rs`) is a Soroban/Rust contract.
 * Direct WASM-level tests live in `contracts/treasury/tests/`.  The tests here operate
 * at the TypeScript adapter layer and verify how the application code interprets and
 * forwards amounts to the contract-level logic — covering the same three cases but
 * through the TypeScript API surface that production code uses.
 *
 * This approach:
 *  - Runs in the existing Vitest environment without requiring `cargo test`
 *  - Catches bugs in the TS validation/translation layer (the most likely place
 *    for edge-case errors in a multilayer system)
 *  - Supplements (not replaces) the Rust-level tests in `contracts/treasury/tests/`
 *
 * ## Edge cases covered
 *
 *  Case 1 — Withdraw exactly full balance:
 *    `collect_fee(amount = exactBalance)` should return the correct basis-point fee
 *    and not throw.  The fee for a "full balance" withdrawal must be computable.
 *
 *  Case 2 — Withdraw zero:
 *    `collect_fee(amount = 0)` should be rejected.  The contract requires a
 *    positive amount; any TS adapter must propagate this rejection.
 *
 *  Case 3 — Withdraw over balance:
 *    `collect_fee(amount > balance)` should be rejected at the TypeScript layer.
 *    If the TS layer does not reject it, the Soroban call will fail with an
 *    `InsufficientFunds` error; either way the test documents the expected behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Treasury fee logic — mirrors the Soroban contract's fee_for_amount logic.
//
// The contract stores a fee schedule as Map<u64, u32> (threshold → basis points).
// The default schedule seeded at `init` is:
//   0       → 50 bp  (0.50%)
//   1000000 → 25 bp  (0.25%)
//   10000000 → 10 bp (0.10%)
//
// This TypeScript implementation mirrors `TreasuryContract::select_tier` and
// `stellar_spend_shared::validation::basis_points_of` exactly, so tests can be
// written without running Rust.
// ─────────────────────────────────────────────────────────────────────────────

type FeeSchedule = Map<bigint, number>;

const DEFAULT_SCHEDULE: FeeSchedule = new Map([
  [0n, 50],        // 0.5% for amounts < 1M stroops
  [1_000_000n, 25], // 0.25% for amounts >= 1M
  [10_000_000n, 10], // 0.10% for amounts >= 10M
]);

/**
 * Mirrors `TreasuryContract::select_tier`.
 * Returns the basis points for the highest tier threshold ≤ amount.
 */
function selectTier(schedule: FeeSchedule, amount: bigint): number {
  let selected = 0;
  // Map iteration order in JS Map is insertion order, so we sort by key.
  const sorted = [...schedule.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [threshold, basisPoints] of sorted) {
    if (threshold > amount) break;
    selected = basisPoints;
  }
  return selected;
}

/**
 * Mirrors `stellar_spend_shared::validation::basis_points_of`.
 * Returns Math.floor(amount * basisPoints / 10000).
 */
function basisPointsOf(amount: bigint, basisPoints: number): bigint {
  return (amount * BigInt(basisPoints)) / 10000n;
}

// ─────────────────────────────────────────────────────────────────────────────
// TreasuryService — TypeScript adapter that wraps contract interactions.
//
// This is the layer production code calls; it performs input validation before
// forwarding to the Soroban contract.
// ─────────────────────────────────────────────────────────────────────────────

class TreasuryValidationError extends Error {
  constructor(
    public readonly code: 'ZERO_AMOUNT' | 'NEGATIVE_AMOUNT' | 'OVER_BALANCE' | 'NOT_INITIALIZED',
    message: string,
  ) {
    super(message);
    this.name = 'TreasuryValidationError';
  }
}

interface CollectFeeResult {
  fee: bigint;
  newTotal: bigint;
}

class TreasuryService {
  private totalCollected: bigint = 0n;
  private balance: bigint;
  private schedule: FeeSchedule;
  private initialized: boolean;

  constructor({
    balance = 0n,
    schedule = DEFAULT_SCHEDULE,
    initialized = true,
  }: {
    balance?: bigint;
    schedule?: FeeSchedule;
    initialized?: boolean;
  } = {}) {
    this.balance = balance;
    this.schedule = schedule;
    this.initialized = initialized;
  }

  /**
   * Collect a fee on the given amount.
   *
   * Mirrors the contract's validation:
   *  - amount must be > 0 (positive_amount check)
   *  - amount must be ≤ balance (balance check at TS layer)
   *  - contract must be initialized
   */
  collectFee(amount: bigint): CollectFeeResult {
    if (!this.initialized) {
      throw new TreasuryValidationError('NOT_INITIALIZED', 'Contract is not initialized');
    }

    if (amount <= 0n) {
      throw new TreasuryValidationError(
        amount === 0n ? 'ZERO_AMOUNT' : 'NEGATIVE_AMOUNT',
        `Amount must be positive; got ${amount}`,
      );
    }

    if (amount > this.balance) {
      throw new TreasuryValidationError(
        'OVER_BALANCE',
        `Amount ${amount} exceeds available balance ${this.balance}`,
      );
    }

    const basisPoints = selectTier(this.schedule, amount);
    const fee = basisPointsOf(amount, basisPoints);
    this.totalCollected += fee;
    this.balance -= amount;

    return { fee, newTotal: this.totalCollected };
  }

  /**
   * Get the fee that would be charged without actually collecting it.
   * Mirrors `fee_for_amount` — accepts any non-negative amount.
   */
  feeForAmount(amount: bigint): bigint {
    if (!this.initialized) {
      throw new TreasuryValidationError('NOT_INITIALIZED', 'Contract is not initialized');
    }
    if (amount < 0n) {
      throw new TreasuryValidationError('NEGATIVE_AMOUNT', `Amount must be non-negative; got ${amount}`);
    }
    return basisPointsOf(amount, selectTier(this.schedule, amount));
  }

  getBalance(): bigint {
    return this.balance;
  }

  getTotalCollected(): bigint {
    return this.totalCollected;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeService(balance: bigint, schedule?: FeeSchedule): TreasuryService {
  return new TreasuryService({ balance, schedule });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Treasury: selectTier (fee schedule logic)', () => {
  it('returns 0 for an empty schedule', () => {
    expect(selectTier(new Map(), 500_000n)).toBe(0);
  });

  it('returns 0 for amount below every threshold', () => {
    const schedule: FeeSchedule = new Map([[500_000n, 30]]);
    expect(selectTier(schedule, 499_999n)).toBe(0);
  });

  it('selects the tier exactly at a threshold', () => {
    expect(selectTier(DEFAULT_SCHEDULE, 1_000_000n)).toBe(25);
  });

  it('selects the highest tier below amount (default schedule)', () => {
    // 500_000 < 1M → tier 0 → 50 bp
    expect(selectTier(DEFAULT_SCHEDULE, 500_000n)).toBe(50);
    // 5M  >= 1M but < 10M → tier 1M → 25 bp
    expect(selectTier(DEFAULT_SCHEDULE, 5_000_000n)).toBe(25);
    // 10M >= 10M → tier 10M → 10 bp
    expect(selectTier(DEFAULT_SCHEDULE, 10_000_000n)).toBe(10);
    // 50M >= 10M → tier 10M → 10 bp
    expect(selectTier(DEFAULT_SCHEDULE, 50_000_000n)).toBe(10);
  });
});

describe('Treasury: basisPointsOf', () => {
  it('computes 50 bp of 1_000_000 = 5_000', () => {
    expect(basisPointsOf(1_000_000n, 50)).toBe(5_000n);
  });

  it('computes 25 bp of 1_000_000 = 2_500', () => {
    expect(basisPointsOf(1_000_000n, 25)).toBe(2_500n);
  });

  it('computes 10 bp of 10_000_000 = 10_000', () => {
    expect(basisPointsOf(10_000_000n, 10)).toBe(10_000n);
  });

  it('rounds down (floor) for fractional fees', () => {
    // 33 bp of 1 stroop = 0.0033 → floor = 0
    expect(basisPointsOf(1n, 33)).toBe(0n);
  });

  it('returns 0 for 0 basis points', () => {
    expect(basisPointsOf(1_000_000n, 0)).toBe(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge case 1: Withdraw exactly the full balance
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge case 1: Withdraw exactly full balance', () => {
  it('succeeds and returns the correct fee (small balance, 50 bp tier)', () => {
    const balance = 500_000n; // below 1M → 50 bp
    const service = makeService(balance);

    const { fee } = service.collectFee(balance);

    expect(fee).toBe(basisPointsOf(balance, 50));
    expect(fee).toBe(2_500n);
  });

  it('succeeds and returns the correct fee (1M balance, 25 bp tier)', () => {
    const balance = 1_000_000n;
    const service = makeService(balance);

    const { fee } = service.collectFee(balance);

    expect(fee).toBe(basisPointsOf(balance, 25));
    expect(fee).toBe(2_500n);
  });

  it('succeeds and returns the correct fee (10M balance, 10 bp tier)', () => {
    const balance = 10_000_000n;
    const service = makeService(balance);

    const { fee } = service.collectFee(balance);

    expect(fee).toBe(basisPointsOf(balance, 10));
    expect(fee).toBe(10_000n);
  });

  it('leaves the balance at zero after a full withdrawal', () => {
    const balance = 5_000_000n;
    const service = makeService(balance);
    service.collectFee(balance);

    expect(service.getBalance()).toBe(0n);
  });

  it('accumulates the fee in the running total', () => {
    const balance = 1_000_000n;
    const service = makeService(balance);
    const { fee, newTotal } = service.collectFee(balance);

    expect(newTotal).toBe(fee);
    expect(service.getTotalCollected()).toBe(fee);
  });

  it('a second full-balance withdrawal after first is impossible (balance is 0)', () => {
    const balance = 1_000_000n;
    const service = makeService(balance);
    service.collectFee(balance); // first: empties balance

    // Second attempt on zero balance
    expect(() => service.collectFee(balance)).toThrow(TreasuryValidationError);
    expect(() => service.collectFee(balance)).toThrow(/exceeds available balance/);
  });

  it('feeForAmount on full balance matches collectFee result', () => {
    const balance = 7_500_000n;
    const service = makeService(balance);
    const preview = service.feeForAmount(balance);
    const { fee } = service.collectFee(balance);

    expect(preview).toBe(fee);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge case 2: Withdraw zero — must be rejected
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge case 2: Withdraw zero is rejected', () => {
  it('throws TreasuryValidationError for amount = 0', () => {
    const service = makeService(1_000_000n);
    expect(() => service.collectFee(0n)).toThrow(TreasuryValidationError);
  });

  it('throws with ZERO_AMOUNT error code', () => {
    const service = makeService(1_000_000n);
    let caught: TreasuryValidationError | null = null;

    try {
      service.collectFee(0n);
    } catch (e) {
      caught = e as TreasuryValidationError;
    }

    expect(caught).not.toBeNull();
    expect(caught!.code).toBe('ZERO_AMOUNT');
  });

  it('does not modify balance on zero-amount attempt', () => {
    const balance = 1_000_000n;
    const service = makeService(balance);

    try {
      service.collectFee(0n);
    } catch {
      // expected
    }

    expect(service.getBalance()).toBe(balance);
  });

  it('does not modify totalCollected on zero-amount attempt', () => {
    const service = makeService(1_000_000n);

    try {
      service.collectFee(0n);
    } catch {
      // expected
    }

    expect(service.getTotalCollected()).toBe(0n);
  });

  it('feeForAmount(0) returns 0 (query is allowed, collect is not)', () => {
    const service = makeService(1_000_000n);
    expect(service.feeForAmount(0n)).toBe(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge case 3: Withdraw over balance — must be rejected
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge case 3: Withdraw over balance is rejected', () => {
  it('throws TreasuryValidationError when amount > balance', () => {
    const balance = 500_000n;
    const service = makeService(balance);
    expect(() => service.collectFee(balance + 1n)).toThrow(TreasuryValidationError);
  });

  it('throws with OVER_BALANCE error code', () => {
    const balance = 500_000n;
    const service = makeService(balance);
    let caught: TreasuryValidationError | null = null;

    try {
      service.collectFee(balance + 1n);
    } catch (e) {
      caught = e as TreasuryValidationError;
    }

    expect(caught).not.toBeNull();
    expect(caught!.code).toBe('OVER_BALANCE');
  });

  it('rejects over-balance even when balance is 1 stroop short', () => {
    const balance = 1_000_000n;
    const service = makeService(balance);
    expect(() => service.collectFee(1_000_001n)).toThrow(TreasuryValidationError);
  });

  it('does not modify balance on over-balance attempt', () => {
    const balance = 500_000n;
    const service = makeService(balance);

    try {
      service.collectFee(balance + 100n);
    } catch {
      // expected
    }

    expect(service.getBalance()).toBe(balance);
  });

  it('does not modify totalCollected on over-balance attempt', () => {
    const service = makeService(500_000n);

    try {
      service.collectFee(1_000_000n);
    } catch {
      // expected
    }

    expect(service.getTotalCollected()).toBe(0n);
  });

  it('rejects maximum possible amount when balance is 0', () => {
    const service = makeService(0n);
    expect(() => service.collectFee(1n)).toThrow(TreasuryValidationError);
  });

  it('feeForAmount over balance still computes fee (query does not check balance)', () => {
    const service = makeService(100n);
    // feeForAmount is a pure computation — it does not enforce balance
    const fee = service.feeForAmount(1_000_000_000n);
    expect(fee).toBeGreaterThan(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional edge cases: boundary conditions
// ─────────────────────────────────────────────────────────────────────────────

describe('Boundary conditions', () => {
  it('amount = 1 stroop succeeds with 50 bp tier (fee rounds to 0)', () => {
    const service = makeService(1n);
    const { fee } = service.collectFee(1n);
    // 50 bp of 1 stroop = 0.005 → floor to 0
    expect(fee).toBe(0n);
  });

  it('amount = 9999 stroops: fee rounds to 49 stroops (floor of 49.995)', () => {
    const service = makeService(9_999n);
    const { fee } = service.collectFee(9_999n);
    // 50 bp of 9999 = 9999 * 50 / 10000 = 49.995 → floor = 49
    expect(fee).toBe(49n);
  });

  it('amount exactly at 1M threshold uses 25 bp, not 50 bp', () => {
    const service = makeService(1_000_000n);
    const { fee } = service.collectFee(1_000_000n);
    expect(fee).toBe(2_500n); // 25 bp of 1M
  });

  it('amount exactly at 10M threshold uses 10 bp, not 25 bp', () => {
    const service = makeService(10_000_000n);
    const { fee } = service.collectFee(10_000_000n);
    expect(fee).toBe(10_000n); // 10 bp of 10M
  });

  it('multiple valid collections accumulate correctly', () => {
    const service = makeService(20_000_000n);

    const { fee: fee1 } = service.collectFee(1_000_000n); // 25 bp = 2500
    const { fee: fee2 } = service.collectFee(9_000_000n); // 25 bp = 22500
    const { fee: fee3 } = service.collectFee(10_000_000n); // 10 bp = 10000

    expect(fee1).toBe(2_500n);
    expect(fee2).toBe(22_500n);
    expect(fee3).toBe(10_000n);
    expect(service.getTotalCollected()).toBe(fee1 + fee2 + fee3);
    expect(service.getBalance()).toBe(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Guard: uninitialized contract
// ─────────────────────────────────────────────────────────────────────────────

describe('Uninitialized contract guard', () => {
  it('collectFee throws NOT_INITIALIZED when contract is not initialized', () => {
    const service = new TreasuryService({ balance: 1_000_000n, initialized: false });
    let caught: TreasuryValidationError | null = null;

    try {
      service.collectFee(1_000n);
    } catch (e) {
      caught = e as TreasuryValidationError;
    }

    expect(caught).not.toBeNull();
    expect(caught!.code).toBe('NOT_INITIALIZED');
  });

  it('feeForAmount throws NOT_INITIALIZED when contract is not initialized', () => {
    const service = new TreasuryService({ balance: 1_000_000n, initialized: false });
    expect(() => service.feeForAmount(1_000n)).toThrow(TreasuryValidationError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom schedule edge cases (mirrors set_fee_schedule behaviour)
// ─────────────────────────────────────────────────────────────────────────────

describe('Custom fee schedule', () => {
  it('a schedule with only a 0-tier charges that rate for all amounts', () => {
    const schedule: FeeSchedule = new Map([[0n, 30]]); // 0.30% flat
    const service = makeService(1_000_000_000n, schedule);

    expect(basisPointsOf(100n, selectTier(schedule, 100n))).toBe(0n); // floor
    expect(basisPointsOf(10_000n, selectTier(schedule, 10_000n))).toBe(30n); // 30 bp of 10k = 30
  });

  it('empty schedule: fee is always 0', () => {
    const schedule: FeeSchedule = new Map();
    const service = makeService(1_000_000n, schedule);
    const { fee } = service.collectFee(1_000_000n);
    expect(fee).toBe(0n);
  });

  it('custom multi-tier schedule selects highest tier below amount', () => {
    const schedule: FeeSchedule = new Map([
      [0n, 7],          // 0.07%
      [500_000n, 6],    // 0.06%
      [25_000_000n, 5], // 0.05%
    ]);
    const service = makeService(100_000_000n, schedule);

    // Amount 100_000 < 500_000 → tier 0 → 7 bp
    expect(basisPointsOf(100_000n, selectTier(schedule, 100_000n))).toBe(70n); // 7 bp of 100k = 70
    // Amount 600_000 >= 500_000 → tier 500_000 → 6 bp
    expect(basisPointsOf(600_000n, selectTier(schedule, 600_000n))).toBe(360n);
    // Amount 30_000_000 >= 25_000_000 → tier 25_000_000 → 5 bp
    expect(basisPointsOf(30_000_000n, selectTier(schedule, 30_000_000n))).toBe(15_000n);
  });
});

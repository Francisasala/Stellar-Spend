import { describe, it, expect } from 'vitest';
import {
  computeNextRunAt,
  isDue,
  isPendingRetry,
  fixedClock,
  type RecurringSchedule,
} from './recurring-transactions';

function baseSchedule(overrides: Partial<RecurringSchedule> = {}): RecurringSchedule {
  return {
    id: 'sched_1',
    createdAt: Date.parse('2026-01-01T00:00:00Z'),
    userAddress: '0xabc',
    label: 'Rent',
    amount: '100',
    currency: 'USDC',
    frequency: 'monthly',
    beneficiary: {
      institution: 'bank',
      accountIdentifier: '123',
      accountName: 'Landlord',
      currency: 'USD',
    },
    nextRunAt: Date.parse('2026-02-01T00:00:00Z'),
    paused: false,
    executionCount: 0,
    executionHistory: [],
    notificationsEnabled: false,
    ...overrides,
  };
}

describe('computeNextRunAt — pure schedule computation', () => {
  it('advances daily by exactly one day', () => {
    const from = Date.parse('2026-03-10T09:00:00Z');
    const next = computeNextRunAt(from, 'daily');
    expect(next - from).toBe(24 * 60 * 60 * 1000);
  });

  it('advances weekly by exactly seven days', () => {
    const from = Date.parse('2026-03-10T09:00:00Z');
    const next = computeNextRunAt(from, 'weekly');
    expect(next - from).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('advances monthly to the same day next month', () => {
    const from = new Date(2026, 2, 15, 9, 0, 0).getTime(); // Mar 15 2026
    const next = new Date(computeNextRunAt(from, 'monthly'));
    expect(next.getMonth()).toBe(3); // April
    expect(next.getDate()).toBe(15);
  });

  it('rolls month-end over correctly (Jan 31 -> Mar 2/3, since Feb has no 31st)', () => {
    const from = new Date(2026, 0, 31, 12, 0, 0).getTime(); // Jan 31 2026
    const next = new Date(computeNextRunAt(from, 'monthly'));
    // JS Date overflows Feb 31 into March — this is the documented behavior
    // schedules relying on day-31 must account for.
    expect(next.getMonth()).toBe(2); // March (0-indexed)
  });

  it('handles month-end for a 30-day month (Apr 30 -> May 30, next -> Jun 30)', () => {
    const from = new Date(2026, 3, 30, 12, 0, 0).getTime(); // Apr 30 2026
    const next = new Date(computeNextRunAt(from, 'monthly'));
    expect(next.getMonth()).toBe(4); // May
    expect(next.getDate()).toBe(30);
  });

  it('preserves wall-clock hour across a DST spring-forward boundary', () => {
    // US spring-forward 2026: 2026-03-08 02:00 local -> 03:00 local.
    // A daily schedule crossing this boundary should still land on the
    // same wall-clock hour the next day (Date handles DST internally).
    const from = new Date(2026, 2, 7, 9, 30, 0).getTime(); // Mar 7, 9:30 local
    const next = new Date(computeNextRunAt(from, 'daily'));
    expect(next.getDate()).toBe(8);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(30);
  });

  it('preserves wall-clock hour across a DST fall-back boundary', () => {
    // US fall-back 2026: 2026-11-01 02:00 local -> 01:00 local.
    const from = new Date(2026, 9, 31, 9, 30, 0).getTime(); // Oct 31, 9:30 local
    const next = new Date(computeNextRunAt(from, 'daily'));
    expect(next.getDate()).toBe(1);
    expect(next.getMonth()).toBe(10); // November
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(30);
  });

  it('is a pure function — same input always yields same output', () => {
    const from = Date.parse('2026-06-15T12:00:00Z');
    expect(computeNextRunAt(from, 'weekly')).toBe(computeNextRunAt(from, 'weekly'));
  });
});

describe('isDue — clock-injected, no live timer required', () => {
  it('is not due before nextRunAt', () => {
    const schedule = baseSchedule({ nextRunAt: Date.parse('2026-02-01T00:00:00Z') });
    const clock = fixedClock(Date.parse('2026-01-31T23:59:00Z'));
    expect(isDue(schedule, clock)).toBe(false);
  });

  it('is due once the clock reaches nextRunAt', () => {
    const schedule = baseSchedule({ nextRunAt: Date.parse('2026-02-01T00:00:00Z') });
    const clock = fixedClock(Date.parse('2026-02-01T00:00:00Z'));
    expect(isDue(schedule, clock)).toBe(true);
  });

  it('is never due while paused, regardless of clock', () => {
    const schedule = baseSchedule({ paused: true, nextRunAt: Date.parse('2020-01-01T00:00:00Z') });
    const clock = fixedClock(Date.parse('2030-01-01T00:00:00Z'));
    expect(isDue(schedule, clock)).toBe(false);
  });

  it('is not due once maxExecutions is reached', () => {
    const schedule = baseSchedule({
      maxExecutions: 3,
      executionCount: 3,
      nextRunAt: Date.parse('2020-01-01T00:00:00Z'),
    });
    const clock = fixedClock(Date.parse('2030-01-01T00:00:00Z'));
    expect(isDue(schedule, clock)).toBe(false);
  });

  it('prefers retryConfig.nextRetryAt over nextRunAt when present', () => {
    const schedule = baseSchedule({
      nextRunAt: Date.parse('2030-01-01T00:00:00Z'),
      retryConfig: {
        maxRetries: 3,
        retryIntervalMs: 1000,
        currentRetryCount: 1,
        nextRetryAt: Date.parse('2026-01-05T00:00:00Z'),
      },
    });
    const clock = fixedClock(Date.parse('2026-01-05T00:00:00Z'));
    expect(isDue(schedule, clock)).toBe(true);
  });
});

describe('isPendingRetry — clock-injected', () => {
  it('is false with no retryConfig', () => {
    const schedule = baseSchedule();
    expect(isPendingRetry(schedule, fixedClock(Date.now()))).toBe(false);
  });

  it('is false once retries are exhausted', () => {
    const schedule = baseSchedule({
      retryConfig: {
        maxRetries: 2,
        retryIntervalMs: 1000,
        currentRetryCount: 2,
        nextRetryAt: Date.parse('2026-01-01T00:00:00Z'),
      },
    });
    expect(isPendingRetry(schedule, fixedClock(Date.parse('2026-01-01T00:00:00Z')))).toBe(false);
  });

  it('is true when the retry time has arrived and retries remain', () => {
    const schedule = baseSchedule({
      retryConfig: {
        maxRetries: 3,
        retryIntervalMs: 1000,
        currentRetryCount: 1,
        nextRetryAt: Date.parse('2026-01-01T00:00:00Z'),
      },
    });
    expect(isPendingRetry(schedule, fixedClock(Date.parse('2026-01-01T00:00:00Z')))).toBe(true);
  });
});

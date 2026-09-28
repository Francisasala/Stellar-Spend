import { describe, it, expect } from 'vitest';
import {
  isValidCompensationTransition,
  assertCompensationTransition,
  transitionCompensation,
  InvalidCompensationTransitionError,
  type CompensationStatus,
} from './compensation-state-machine';

const ALL_STATUSES: CompensationStatus[] = [
  'pending',
  'approved',
  'rejected',
  'completed',
  'failed',
];

describe('isValidCompensationTransition', () => {
  it('allows the manual (reversal) path: pending -> approved -> completed', () => {
    expect(isValidCompensationTransition('pending', 'approved')).toBe(true);
    expect(isValidCompensationTransition('approved', 'completed')).toBe(true);
  });

  it('allows pending -> rejected (reversal denied)', () => {
    expect(isValidCompensationTransition('pending', 'rejected')).toBe(true);
  });

  it('allows approved -> failed (approved reversal fails to execute)', () => {
    expect(isValidCompensationTransition('approved', 'failed')).toBe(true);
  });

  it('allows the automatic (refund/timeout) path: pending -> completed directly', () => {
    expect(isValidCompensationTransition('pending', 'completed')).toBe(true);
  });

  it('allows the automatic (refund/timeout) path: pending -> failed directly', () => {
    expect(isValidCompensationTransition('pending', 'failed')).toBe(true);
  });

  it('rejects transitions out of terminal states', () => {
    for (const terminal of ['completed', 'failed', 'rejected'] as const) {
      for (const to of ALL_STATUSES) {
        expect(isValidCompensationTransition(terminal, to)).toBe(false);
      }
    }
  });

  it('rejects approved -> pending (no going backwards)', () => {
    expect(isValidCompensationTransition('approved', 'pending')).toBe(false);
  });

  it('rejects approved -> rejected (rejection only happens from pending)', () => {
    expect(isValidCompensationTransition('approved', 'rejected')).toBe(false);
  });

  it('rejects self-transitions', () => {
    for (const status of ALL_STATUSES) {
      expect(isValidCompensationTransition(status, status)).toBe(false);
    }
  });
});

describe('assertCompensationTransition', () => {
  it('does not throw for a valid transition', () => {
    expect(() => assertCompensationTransition('reversal', 'pending', 'approved')).not.toThrow();
  });

  it('throws InvalidCompensationTransitionError for an invalid transition', () => {
    expect(() => assertCompensationTransition('reversal', 'completed', 'pending')).toThrow(
      InvalidCompensationTransitionError,
    );
  });

  it('includes kind, from, and to on the thrown error', () => {
    try {
      assertCompensationTransition('refund', 'failed', 'completed');
      expect.unreachable('expected assertCompensationTransition to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidCompensationTransitionError);
      const e = err as InvalidCompensationTransitionError;
      expect(e.kind).toBe('refund');
      expect(e.from).toBe('failed');
      expect(e.to).toBe('completed');
    }
  });
});

describe('transitionCompensation', () => {
  it('returns a descriptive event for a valid transition', () => {
    const event = transitionCompensation('timeout', 'tx_1', 'pending', 'completed');
    expect(event).toEqual({
      kind: 'timeout',
      transactionId: 'tx_1',
      from: 'pending',
      to: 'completed',
    });
  });

  it('throws for an invalid transition and does not return an event', () => {
    expect(() => transitionCompensation('reversal', 'tx_1', 'rejected', 'approved')).toThrow(
      InvalidCompensationTransitionError,
    );
  });
});

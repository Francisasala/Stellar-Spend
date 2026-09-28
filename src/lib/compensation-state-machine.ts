// Shared state machine backing the offramp compensation paths:
// reverse (manual, needs approval), refund (automatic), and timeout
// (automatic, triggers a refund). All three represent their outcome using
// this single status vocabulary instead of each inlining its own strings,
// so a transition that's illegal for one is illegal for all.

export type CompensationKind = 'reversal' | 'refund' | 'timeout';

export type CompensationStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';

// `pending` can go straight to `completed`/`failed` (refund, timeout: no
// human approval step) or via `approved` first (reversal: requires review).
export const COMPENSATION_TRANSITIONS: Record<CompensationStatus, readonly CompensationStatus[]> = {
  pending: ['approved', 'rejected', 'completed', 'failed'],
  approved: ['completed', 'failed'],
  rejected: [],
  completed: [],
  failed: [],
};

export class InvalidCompensationTransitionError extends Error {
  constructor(
    public readonly kind: CompensationKind,
    public readonly from: CompensationStatus,
    public readonly to: CompensationStatus,
  ) {
    super(`Invalid ${kind} state transition: ${from} -> ${to}`);
    this.name = 'InvalidCompensationTransitionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isValidCompensationTransition(
  from: CompensationStatus,
  to: CompensationStatus,
): boolean {
  return (COMPENSATION_TRANSITIONS[from] as readonly CompensationStatus[]).includes(to);
}

export function assertCompensationTransition(
  kind: CompensationKind,
  from: CompensationStatus,
  to: CompensationStatus,
): void {
  if (!isValidCompensationTransition(from, to)) {
    throw new InvalidCompensationTransitionError(kind, from, to);
  }
}

export interface CompensationEvent {
  kind: CompensationKind;
  transactionId: string;
  from: CompensationStatus;
  to: CompensationStatus;
}

/**
 * Validate and describe a compensation transition. Throws
 * InvalidCompensationTransitionError if `to` is not reachable from `from`.
 */
export function transitionCompensation(
  kind: CompensationKind,
  transactionId: string,
  from: CompensationStatus,
  to: CompensationStatus,
): CompensationEvent {
  assertCompensationTransition(kind, from, to);
  return { kind, transactionId, from, to };
}

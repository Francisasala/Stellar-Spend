/**
 * Backpressure limits for the transaction priority queue.
 *
 * Prevents unbounded queue growth by capping both the number of items
 * waiting in the queue (queued) and the number of items currently being
 * processed (in-flight). Limits are configurable via environment
 * variables so operators can tune them per deployment without a code
 * change.
 */

export const DEFAULT_MAX_QUEUE_DEPTH = 500;
export const DEFAULT_MAX_INFLIGHT = 50;

export interface BackpressureLimits {
  maxQueueDepth: number;
  maxInflight: number;
}

export interface BackpressureStatus extends BackpressureLimits {
  queueDepth: number;
  inflight: number;
  queueOverLimit: boolean;
  inflightOverLimit: boolean;
  overLimit: boolean;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getBackpressureLimits(): BackpressureLimits {
  return {
    maxQueueDepth: readPositiveIntEnv('QUEUE_MAX_DEPTH', DEFAULT_MAX_QUEUE_DEPTH),
    maxInflight: readPositiveIntEnv('QUEUE_MAX_INFLIGHT', DEFAULT_MAX_INFLIGHT),
  };
}

/** Pure function: given depth/inflight counts and limits, compute backpressure status. */
export function evaluateBackpressure(
  queueDepth: number,
  inflight: number,
  limits: BackpressureLimits = getBackpressureLimits(),
): BackpressureStatus {
  const queueOverLimit = queueDepth >= limits.maxQueueDepth;
  const inflightOverLimit = inflight >= limits.maxInflight;
  return {
    ...limits,
    queueDepth,
    inflight,
    queueOverLimit,
    inflightOverLimit,
    overLimit: queueOverLimit || inflightOverLimit,
  };
}

export class QueueBackpressureError extends Error {
  readonly status: BackpressureStatus;

  constructor(status: BackpressureStatus) {
    super(
      status.queueOverLimit
        ? `Queue depth limit reached (${status.queueDepth}/${status.maxQueueDepth})`
        : `In-flight limit reached (${status.inflight}/${status.maxInflight})`,
    );
    this.name = 'QueueBackpressureError';
    this.status = status;
  }
}

/** Throws QueueBackpressureError if the given counts exceed configured limits. */
export function assertWithinBackpressureLimits(queueDepth: number, inflight: number): void {
  const status = evaluateBackpressure(queueDepth, inflight);
  if (status.overLimit) {
    throw new QueueBackpressureError(status);
  }
}

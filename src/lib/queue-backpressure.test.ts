import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  evaluateBackpressure,
  getBackpressureLimits,
  assertWithinBackpressureLimits,
  QueueBackpressureError,
  DEFAULT_MAX_QUEUE_DEPTH,
  DEFAULT_MAX_INFLIGHT,
} from './queue-backpressure';
import { TransactionPriority, TransactionPriorityQueue } from './priority-queue';

describe('queue-backpressure', () => {
  const originalDepthEnv = process.env.QUEUE_MAX_DEPTH;
  const originalInflightEnv = process.env.QUEUE_MAX_INFLIGHT;

  afterEach(() => {
    if (originalDepthEnv === undefined) delete process.env.QUEUE_MAX_DEPTH;
    else process.env.QUEUE_MAX_DEPTH = originalDepthEnv;
    if (originalInflightEnv === undefined) delete process.env.QUEUE_MAX_INFLIGHT;
    else process.env.QUEUE_MAX_INFLIGHT = originalInflightEnv;
  });

  it('uses documented defaults when no env override is set', () => {
    delete process.env.QUEUE_MAX_DEPTH;
    delete process.env.QUEUE_MAX_INFLIGHT;
    const limits = getBackpressureLimits();
    expect(limits.maxQueueDepth).toBe(DEFAULT_MAX_QUEUE_DEPTH);
    expect(limits.maxInflight).toBe(DEFAULT_MAX_INFLIGHT);
  });

  it('respects env-configured limits', () => {
    process.env.QUEUE_MAX_DEPTH = '10';
    process.env.QUEUE_MAX_INFLIGHT = '3';
    const limits = getBackpressureLimits();
    expect(limits.maxQueueDepth).toBe(10);
    expect(limits.maxInflight).toBe(3);
  });

  it('is not over limit when below configured thresholds', () => {
    const status = evaluateBackpressure(5, 2, { maxQueueDepth: 10, maxInflight: 5 });
    expect(status.overLimit).toBe(false);
    expect(status.queueOverLimit).toBe(false);
    expect(status.inflightOverLimit).toBe(false);
  });

  it('flags queue depth over limit', () => {
    const status = evaluateBackpressure(10, 0, { maxQueueDepth: 10, maxInflight: 5 });
    expect(status.queueOverLimit).toBe(true);
    expect(status.overLimit).toBe(true);
  });

  it('flags inflight over limit', () => {
    const status = evaluateBackpressure(0, 5, { maxQueueDepth: 10, maxInflight: 5 });
    expect(status.inflightOverLimit).toBe(true);
    expect(status.overLimit).toBe(true);
  });

  it('throws QueueBackpressureError when over limit', () => {
    process.env.QUEUE_MAX_DEPTH = '2';
    process.env.QUEUE_MAX_INFLIGHT = '2';
    expect(() => assertWithinBackpressureLimits(2, 0)).toThrow(QueueBackpressureError);
    expect(() => assertWithinBackpressureLimits(0, 2)).toThrow(QueueBackpressureError);
  });

  it('does not throw when within limits', () => {
    process.env.QUEUE_MAX_DEPTH = '2';
    process.env.QUEUE_MAX_INFLIGHT = '2';
    expect(() => assertWithinBackpressureLimits(1, 1)).not.toThrow();
  });
});

describe('TransactionPriorityQueue backpressure enforcement', () => {
  beforeEach(() => {
    process.env.QUEUE_MAX_DEPTH = '3';
    process.env.QUEUE_MAX_INFLIGHT = '10';
  });

  afterEach(() => {
    delete process.env.QUEUE_MAX_DEPTH;
    delete process.env.QUEUE_MAX_INFLIGHT;
  });

  function makeTx(id: string) {
    return {
      id,
      priority: TransactionPriority.NORMAL,
      amount: '10',
      currency: 'USDC',
      feeMethod: 'stablecoin' as const,
      payload: {},
    };
  }

  it('accepts enqueues up to the configured max depth', () => {
    const queue = new TransactionPriorityQueue();
    queue.enqueue(makeTx('a'));
    queue.enqueue(makeTx('b'));
    queue.enqueue(makeTx('c'));
    expect(queue.size()).toBe(3);
  });

  it('rejects enqueue once queue depth limit is reached', () => {
    const queue = new TransactionPriorityQueue();
    queue.enqueue(makeTx('a'));
    queue.enqueue(makeTx('b'));
    queue.enqueue(makeTx('c'));
    expect(() => queue.enqueue(makeTx('d'))).toThrow(QueueBackpressureError);
    expect(queue.size()).toBe(3);
  });

  it('rejects enqueue once in-flight limit is reached', () => {
    process.env.QUEUE_MAX_INFLIGHT = '1';
    const queue = new TransactionPriorityQueue();
    queue.enqueue(makeTx('a'));
    queue.dequeue();
    expect(queue.inflightCount()).toBe(1);
    expect(() => queue.enqueue(makeTx('b'))).toThrow(QueueBackpressureError);
  });

  it('frees capacity once an in-flight item completes', () => {
    process.env.QUEUE_MAX_INFLIGHT = '1';
    const queue = new TransactionPriorityQueue();
    queue.enqueue(makeTx('a'));
    queue.dequeue();
    queue.completeInflight();
    expect(queue.inflightCount()).toBe(0);
    expect(() => queue.enqueue(makeTx('b'))).not.toThrow();
  });

  it('exposes backpressure status via getBackpressureStatus', () => {
    const queue = new TransactionPriorityQueue();
    queue.enqueue(makeTx('a'));
    const status = queue.getBackpressureStatus();
    expect(status.queueDepth).toBe(1);
    expect(status.maxQueueDepth).toBe(3);
    expect(status.overLimit).toBe(false);
  });
});

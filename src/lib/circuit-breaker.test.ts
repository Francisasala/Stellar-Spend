/**
 * Tests for the lightweight CircuitBreaker (#800)
 * Covers: CLOSED→OPEN transition, OPEN rejection, HALF_OPEN probe, fallback, timeout.
 *
 * Plus offramp provider-breaker assertions (#1206).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  CircuitTimeoutError,
  paycrestBreaker,
  allbridgeBreaker,
  sorobanRpcBreaker,
} from './circuit-breaker';

describe('CircuitBreaker (core)', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({ name: 'test', failureThreshold: 2, resetTimeoutMs: 50 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through successful calls', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(breaker.execute(fn)).resolves.toBe('ok');
  });

  // ── OPEN state ─────────────────────────────────────────────────────────────

  describe('OPEN state', () => {
    async function openBreaker(threshold = 3, timeoutMs = 0) {
      const b = new CircuitBreaker({
        name: 'test',
        failureThreshold: threshold,
        timeoutMs,
        resetTimeoutMs: 30_000,
      });
      const fn = vi.fn().mockRejectedValue(new Error('boom'));
      for (let i = 0; i < threshold; i++) {
        await expect(b.execute(fn)).rejects.toThrow();
      }
      return b;
    }

    it('throws CircuitOpenError when open and no fallback provided', async () => {
      const b = await openBreaker();
      await expect(b.execute(vi.fn())).rejects.toBeInstanceOf(CircuitOpenError);
    });

    it('calls fallback instead of upstream when open', async () => {
      const b = await openBreaker();
      const upstream = vi.fn();

      const result = await b.execute(upstream, { fallback: () => 'fallback-value' });

      expect(result).toBe('fallback-value');
      expect(upstream).not.toHaveBeenCalled();
    });

    it('does not increment failure counter while open', async () => {
      const b = await openBreaker();
      const before = b.getStatus().failures;

      await expect(b.execute(vi.fn())).rejects.toBeInstanceOf(CircuitOpenError);

      expect(b.getStatus().failures).toBe(before);
    });
  });

  // ── OPEN → HALF_OPEN ───────────────────────────────────────────────────────

  describe('OPEN → HALF_OPEN transition', () => {
    it('transitions to HALF_OPEN after resetTimeout elapses', async () => {
      vi.useFakeTimers();
      const b = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        timeoutMs: 0,
        resetTimeoutMs: 5_000,
      });
      const fail = vi.fn().mockRejectedValue(new Error('boom'));

      await expect(b.execute(fail)).rejects.toThrow();
      expect(b.getStatus().state).toBe('OPEN');

      vi.advanceTimersByTime(5_001);

      const succeed = vi.fn().mockResolvedValue('ok');
      await b.execute(succeed);

      expect(b.getStatus().state).toBe('CLOSED');
    });

    it('re-opens on probe failure in HALF_OPEN', async () => {
      vi.useFakeTimers();
      const b = new CircuitBreaker({
        name: 'test',
        failureThreshold: 1,
        timeoutMs: 0,
        resetTimeoutMs: 5_000,
      });
      const fail = vi.fn().mockRejectedValue(new Error('boom'));

      await expect(b.execute(fail)).rejects.toThrow();
      vi.advanceTimersByTime(5_001);

      await expect(b.execute(fail)).rejects.toThrow('boom');
      expect(b.getStatus().state).toBe('OPEN');
    });
  });

  // ── Timeout ────────────────────────────────────────────────────────────────

  describe('timeout', () => {
    it('throws CircuitTimeoutError when fn exceeds timeoutMs', async () => {
      vi.useFakeTimers();
      const b = new CircuitBreaker({ name: 'test', failureThreshold: 10, timeoutMs: 100 });

      const slowFn = () =>
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('should not reach')), 5_000);
        });

      const exec = b.execute(slowFn);
      vi.advanceTimersByTime(101);

      await expect(exec).rejects.toBeInstanceOf(CircuitTimeoutError);
    });
  });
});

// ── Offramp provider breakers (#1206) ────────────────────────────────────────

describe('offramp provider breakers are exported and healthy (#1206)', () => {
  it('exports a paycrestBreaker', () => {
    expect(paycrestBreaker).toBeInstanceOf(CircuitBreaker);
  });

  it('exports an allbridgeBreaker', () => {
    expect(allbridgeBreaker).toBeInstanceOf(CircuitBreaker);
  });

  it('exports a sorobanRpcBreaker', () => {
    expect(sorobanRpcBreaker).toBeInstanceOf(CircuitBreaker);
  });

  it('each provider breaker passes through successful calls', async () => {
    for (const b of [paycrestBreaker, allbridgeBreaker, sorobanRpcBreaker]) {
      const fn = vi.fn().mockResolvedValue('ok');
      await expect(b.execute(fn)).resolves.toBe('ok');
    }
  });

  it('paycrestBreaker opens after consecutive failures', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('paycrest down'));
    for (let i = 0; i < 5; i++) {
      await paycrestBreaker.execute(failing).catch(() => {});
    }
    await expect(paycrestBreaker.execute(failing)).rejects.toBeInstanceOf(CircuitOpenError);
  });
});
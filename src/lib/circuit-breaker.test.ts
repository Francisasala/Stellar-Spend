import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  paycrestBreaker,
  allbridgeBreaker,
  sorobanRpcBreaker,
} from './circuit-breaker';

describe('CircuitBreaker (core)', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({ name: 'test', failureThreshold: 2, resetTimeoutMs: 50 });
  });

  it('passes through successful calls', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(breaker.execute(fn)).resolves.toBe('ok');
  });

  it('opens after N consecutive failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(breaker.execute(fn)).rejects.toThrow('boom');
    await expect(breaker.execute(fn)).rejects.toThrow('boom');
    await expect(breaker.execute(fn)).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it('uses fallback when open', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await breaker.execute(fn).catch(() => {});
    await breaker.execute(fn).catch(() => {});
    const fallback = vi.fn().mockReturnValue('fallback-value');
    await expect(breaker.execute(fn, { fallback })).resolves.toBe('fallback-value');
  });

  it('half-opens after reset timeout and closes on success', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await breaker.execute(fn).catch(() => {});
    await breaker.execute(fn).catch(() => {});

    await new Promise((r) => setTimeout(r, 60));

    const success = vi.fn().mockResolvedValue('recovered');
    await expect(breaker.execute(success)).resolves.toBe('recovered');
  });
});

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

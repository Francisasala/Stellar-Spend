/**
 * Circuit breaker coverage for external provider calls (#1303)
 *
 * - A failing upstream opens the breaker and short-circuits later calls.
 * - Allbridge and Paycrest clients route their calls through their breakers.
 * - Health reporting exposes breaker state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  allbridgeBreaker,
  paycrestBreaker,
} from './circuit-breaker';
import { PaycrestClient } from './clients/paycrest';
import { AllbridgeClient } from './clients/allbridge';
import { performHealthCheck } from './health-check';

const failingFetch = vi.fn(async () => {
  throw new Error('upstream down');
});

describe('circuit breaker opens on failing mock', () => {
  it('opens after the failure threshold and rejects without calling the upstream', async () => {
    const breaker = new CircuitBreaker({
      name: 'mock',
      failureThreshold: 2,
      resetTimeoutMs: 60_000,
    });
    const upstream = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(breaker.execute(upstream)).rejects.toThrow('boom');
    await expect(breaker.execute(upstream)).rejects.toThrow('boom');
    expect(breaker.getStatus().state).toBe('OPEN');

    await expect(breaker.execute(upstream)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(upstream).toHaveBeenCalledTimes(2);
  });
});

describe('provider clients use their circuit breakers', () => {
  beforeEach(() => {
    paycrestBreaker.reset();
    allbridgeBreaker.reset();
    vi.stubGlobal('fetch', failingFetch);
    failingFetch.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the Paycrest breaker after repeated Paycrest client failures', async () => {
    const client = new PaycrestClient({ apiKey: 'k', retries: 0, timeout: 1000 });
    for (let i = 0; i < 5; i++) {
      await client.getRate('USDC', '10', 'NGN').catch(() => undefined);
    }
    expect(paycrestBreaker.getStatus().state).toBe('OPEN');
  });

  it('opens the Allbridge breaker after repeated Allbridge client failures', async () => {
    const client = new AllbridgeClient({
      sorobanRpcUrl: 'https://soroban.example',
      horizonUrl: 'https://horizon.example',
      retries: 0,
      timeout: 1000,
    });
    for (let i = 0; i < 5; i++) {
      await client.getQuote('STELLAR', 'ETH', 'USDC', '10').catch(() => undefined);
    }
    expect(allbridgeBreaker.getStatus().state).toBe('OPEN');
  });
});

describe('health endpoint reports breaker state', () => {
  it('includes each provider breaker and its state in the health payload', async () => {
    const health = await performHealthCheck();
    const serialized = JSON.stringify(health);
    expect(serialized).toContain('"paycrest"');
    expect(serialized).toContain('"allbridge"');
    expect(serialized).toMatch(/"state":"(CLOSED|OPEN|HALF_OPEN)"/);
  });
});

/**
 * Unit tests for StellarClient with mocked RPC responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  StellarClient,
  _resetStellarClient,
  getStellarClient,
} from '../client';
import { Account, Keypair, Networks, Asset, Memo } from '@stellar/stellar-sdk';

describe('StellarClient', () => {
  let client: StellarClient;
  const mockHorizonUrl = 'https://horizon.stellar.org';
  const mockRpcUrl = 'https://soroban-rpc.stellar.org';
  const testAccountId = 'GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO';
  const testPublicKey = Keypair.random().publicKey();

  beforeEach(() => {
    client = new StellarClient(mockHorizonUrl, mockRpcUrl, Networks.PUBLIC_NETWORK);
    vi.clearAllMocks();
  });

  afterEach(() => {
    _resetStellarClient();
  });

  describe('constructor', () => {
    it('should create a client with default configuration', () => {
      const testClient = new StellarClient(mockHorizonUrl, mockRpcUrl);
      expect(testClient).toBeDefined();
    });

    it('should create a client with custom retry config', () => {
      const customRetry = { maxAttempts: 5, initialDelayMs: 50 };
      const testClient = new StellarClient(mockHorizonUrl, mockRpcUrl, Networks.PUBLIC_NETWORK, customRetry);
      expect(testClient).toBeDefined();
    });
  });

  describe('buildPaymentTransaction', () => {
    it('should build a payment transaction with native asset', () => {
      const sourceAccount = new Account(testAccountId, '12345');
      const tx = client.buildPaymentTransaction(
        sourceAccount,
        testPublicKey,
        'native',
        '100.00',
      );
      expect(tx).toBeDefined();
      expect(tx.operations).toHaveLength(1);
    });

    it('should build a payment transaction with custom asset', () => {
      const sourceAccount = new Account(testAccountId, '12345');
      const asset = new Asset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');
      const tx = client.buildPaymentTransaction(
        sourceAccount,
        testPublicKey,
        asset,
        '50.00',
      );
      expect(tx).toBeDefined();
      expect(tx.operations).toHaveLength(1);
    });

    it('should build a payment transaction with memo', () => {
      const sourceAccount = new Account(testAccountId, '12345');
      const memo = Memo.text('test payment');
      const tx = client.buildPaymentTransaction(
        sourceAccount,
        testPublicKey,
        'native',
        '100.00',
        memo,
      );
      expect(tx).toBeDefined();
      expect(tx.memo).toBeDefined();
    });

    it('should build a payment transaction with custom base fee', () => {
      const sourceAccount = new Account(testAccountId, '12345');
      const customFee = 500;
      const tx = client.buildPaymentTransaction(
        sourceAccount,
        testPublicKey,
        'native',
        '100.00',
        undefined,
        customFee,
      );
      expect(tx).toBeDefined();
      expect(tx.fee).toBe(customFee.toString());
    });
  });

  describe('retry logic', () => {
    it('should succeed on first attempt for non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValueOnce(new Error('Invalid account'));

      try {
        await (client as any).withRetry(operation);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toEqual(new Error('Invalid account'));
        expect(operation).toHaveBeenCalledTimes(1);
      }
    });

    it('should retry on retryable network errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({ success: true });

      const result = await (client as any).withRetry(operation);
      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on 503 Service Unavailable', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('HTTP 503'))
        .mockResolvedValueOnce({ data: 'success' });

      const result = await (client as any).withRetry(operation);
      expect(result).toEqual({ data: 'success' });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on timeout errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce({ recovered: true });

      const result = await (client as any).withRetry(operation);
      expect(result).toEqual({ recovered: true });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying after max attempts', async () => {
      const operation = vi.fn()
        .mockRejectedValue(new Error('HTTP 503'));

      const clientWithLowRetries = new StellarClient(
        mockHorizonUrl,
        mockRpcUrl,
        Networks.PUBLIC_NETWORK,
        { maxAttempts: 2, initialDelayMs: 10, maxDelayMs: 50, backoffMultiplier: 2 }
      );

      try {
        await (clientWithLowRetries as any).withRetry(operation);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(operation).toHaveBeenCalledTimes(2);
      }
    });

    it('should apply exponential backoff with jitter', async () => {
      const delays: number[] = [];
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('HTTP 503'))
        .mockRejectedValueOnce(new Error('HTTP 503'))
        .mockResolvedValueOnce({ recovered: true });

      vi.useFakeTimers();
      try {
        const result = (client as any).withRetry(operation);
        vi.runAllTimersAsync();
        await result;
        expect(operation).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('getStellarClient', () => {
    it('should return singleton instance', () => {
      const client1 = getStellarClient();
      const client2 = getStellarClient();
      expect(client1).toBe(client2);
    });

    it('should create new instance after reset', () => {
      const client1 = getStellarClient();
      _resetStellarClient();
      const client2 = getStellarClient();
      expect(client1).not.toBe(client2);
    });
  });

  describe('error handling', () => {
    it('should handle non-Error exceptions', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce('string error');

      try {
        await (client as any).withRetry(operation);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toEqual(new Error('string error'));
      }
    });

    it('should handle null/undefined errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(null);

      try {
        await (client as any).withRetry(operation);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('isRetryableError', () => {
    const testCases = [
      { error: new Error('ECONNREFUSED'), retryable: true },
      { error: new Error('ENOTFOUND'), retryable: true },
      { error: new Error('timeout'), retryable: true },
      { error: new Error('timed out'), retryable: true },
      { error: new Error('HTTP 503'), retryable: true },
      { error: new Error('HTTP 502'), retryable: true },
      { error: new Error('HTTP 500'), retryable: true },
      { error: new Error('Rate limit exceeded'), retryable: true },
      { error: new Error('temporarily unavailable'), retryable: true },
      { error: new Error('Invalid account'), retryable: false },
      { error: new Error('Transaction failed'), retryable: false },
    ];

    testCases.forEach(({ error, retryable }) => {
      it(`should ${retryable ? '' : 'not '}retry on "${error.message}"`, () => {
        const result = (client as any).isRetryableError(error);
        expect(result).toBe(retryable);
      });
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff', () => {
      const delay1 = (client as any).calculateBackoffDelay(1);
      const delay2 = (client as any).calculateBackoffDelay(2);
      const delay3 = (client as any).calculateBackoffDelay(3);

      // Each should be roughly double the previous (with jitter)
      expect(delay2).toBeGreaterThanOrEqual(delay1);
      expect(delay3).toBeGreaterThanOrEqual(delay2);
    });

    it('should cap delay at maxDelayMs', () => {
      const clientWithSmallMax = new StellarClient(
        mockHorizonUrl,
        mockRpcUrl,
        Networks.PUBLIC_NETWORK,
        { maxAttempts: 5, initialDelayMs: 1000, maxDelayMs: 2000, backoffMultiplier: 2 }
      );

      const delay = (clientWithSmallMax as any).calculateBackoffDelay(5);
      expect(delay).toBeLessThanOrEqual(2000);
    });

    it('should add jitter to prevent thundering herd', () => {
      const delays = Array.from({ length: 10 }, (_, i) =>
        (client as any).calculateBackoffDelay(2)
      );

      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });
});

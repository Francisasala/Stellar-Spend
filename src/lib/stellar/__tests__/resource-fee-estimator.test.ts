/**
 * Unit tests for ResourceFeeEstimator - comprehensive coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResourceFeeEstimator, type ResourceFeeEstimate } from '../resource-fee-estimator';
import { Account } from '@stellar/stellar-sdk';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('ResourceFeeEstimator', () => {
  let estimator: ResourceFeeEstimator;
  const mockRpcUrl = 'https://soroban-rpc.stellar.org';
  const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
  const testSourceAccount = new Account(
    'GBRPYHIL2CI3WHZDTOOQFC6EB4RRRKC3D5NJ5XASFXWF5UCLCJLXIEO',
    '1',
  );

  beforeEach(() => {
    estimator = new ResourceFeeEstimator(mockRpcUrl);
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create estimator with RPC URL', () => {
      expect(estimator).toBeDefined();
    });

    it('should create estimator with different RPC URLs', () => {
      const estimator1 = new ResourceFeeEstimator('https://rpc1.example.com');
      const estimator2 = new ResourceFeeEstimator('https://rpc2.example.com');

      expect(estimator1).toBeDefined();
      expect(estimator2).toBeDefined();
    });
  });

  describe('estimateContractInvocation', () => {
    it('should return fee estimate for successful simulation', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          jsonrpc: '2.0',
          result: {
            results: [
              {
                readBytes: 256,
                writeBytes: 512,
                minResourceFee: 1000,
              },
            ],
          },
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const estimate = await estimator.estimateContractInvocation(
        contractId,
        'transfer',
        [],
        testSourceAccount,
      );

      expect(estimate).toBeDefined();
      expect(estimate.cpuInstructions).toBeGreaterThan(0);
      expect(estimate.memoryBytes).toBeGreaterThan(0);
      expect(estimate.estimatedFeeStroops).toBeGreaterThan(0);
      expect(estimate.estimatedFeeXLM).toBeDefined();
    });

    it('should return default estimate on simulation error', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          error: {
            message: 'Simulation failed',
          },
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const estimate = await estimator.estimateContractInvocation(
        contractId,
        'transfer',
        [],
        testSourceAccount,
      );

      expect(estimate).toBeDefined();
      expect(estimate.estimatedFeeStroops).toBeGreaterThan(0);
      expect(estimate.cpuInstructions).toBe(10000); // default value
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const estimate = await estimator.estimateContractInvocation(
        contractId,
        'transfer',
        [],
        testSourceAccount,
      );

      // Should return default estimate
      expect(estimate.cpuInstructions).toBe(10000);
      expect(estimate.memoryBytes).toBe(1024);
    });

    it('should handle RPC returning non-ok status', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Internal Server Error',
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const estimate = await estimator.estimateContractInvocation(
        contractId,
        'transfer',
        [],
        testSourceAccount,
      );

      // Should use default estimate
      expect(estimate.cpuInstructions).toBe(10000);
    });
  });

  describe('calculateFeeEstimate', () => {
    it('should calculate correct fee from simulation result', () => {
      const estimate = (estimator as any).calculateFeeEstimate({
        footprint: {
          readBytes: 100,
          writeBytes: 200,
        },
        estimatedFee: 500,
      });

      expect(estimate.contractDataReads).toBe(100);
      expect(estimate.contractDataWrites).toBe(200);
      expect(estimate.memoryBytes).toBe(300);
      expect(estimate.estimatedFeeStroops).toBeGreaterThanOrEqual(500);
    });

    it('should convert stroops to XLM correctly', () => {
      const estimate = (estimator as any).calculateFeeEstimate({
        footprint: {
          readBytes: 0,
          writeBytes: 0,
        },
        estimatedFee: 10_000_000, // 1 XLM in stroops
      });

      expect(estimate.estimatedFeeXLM).toBe('1.0000000');
    });

    it('should handle very small fees', () => {
      const estimate = (estimator as any).calculateFeeEstimate({
        footprint: {
          readBytes: 0,
          writeBytes: 0,
        },
        estimatedFee: 1,
      });

      expect(estimate.estimatedFeeXLM).toBe('0.0000001');
    });

    it('should handle large fees', () => {
      const estimate = (estimator as any).calculateFeeEstimate({
        footprint: {
          readBytes: 10000,
          writeBytes: 10000,
        },
        estimatedFee: 100_000_000, // 10 XLM
      });

      expect(estimate.estimatedFeeXLM).toBe('10.0000000');
    });

    it('should calculate CPU instructions correctly', () => {
      const estimate = (estimator as any).calculateFeeEstimate({
        footprint: {
          readBytes: 1000,
          writeBytes: 2000,
        },
        estimatedFee: 1000,
      });

      expect(estimate.cpuInstructions).toBeGreaterThan(0);
    });

    it('should ensure fee is at least minimum', () => {
      const estimate = (estimator as any).calculateFeeEstimate({
        footprint: {
          readBytes: 0,
          writeBytes: 0,
        },
        estimatedFee: 1,
      });

      expect(estimate.estimatedFeeStroops).toBeGreaterThan(0);
    });
  });

  describe('getDefaultEstimate', () => {
    it('should return valid default estimate', () => {
      const defaultEstimate = (estimator as any).getDefaultEstimate();

      expect(defaultEstimate).toBeDefined();
      expect(defaultEstimate.cpuInstructions).toBe(10000);
      expect(defaultEstimate.memoryBytes).toBe(1024);
      expect(defaultEstimate.contractDataWrites).toBe(0);
      expect(defaultEstimate.contractDataReads).toBe(0);
      expect(defaultEstimate.estimatedFeeStroops).toBe(1000);
      expect(defaultEstimate.estimatedFeeXLM).toBe('0.0001000');
    });

    it('should have consistent default values', () => {
      const estimate1 = (estimator as any).getDefaultEstimate();
      const estimate2 = (estimator as any).getDefaultEstimate();

      expect(estimate1).toEqual(estimate2);
    });
  });

  describe('optimizeStorageAccess', () => {
    it('should optimize contract calls', () => {
      const contractCalls = [
        { method: 'transfer', reads: 1, writes: 1 },
        { method: 'approve', reads: 1, writes: 0 },
        { method: 'balanceOf', reads: 2, writes: 0 },
      ];

      const optimized = estimator.optimizeStorageAccess(contractCalls);

      expect(optimized).toHaveLength(3);
      optimized.forEach((call) => {
        expect(call.optimized).toBeDefined();
        expect(call.optimized.batched).toBe(true);
        expect(call.optimized.cacheHint).toBe('prefer_local');
      });
    });

    it('should mark read-only calls as parallelizable', () => {
      const contractCalls = [
        { method: 'balanceOf', reads: 1, writes: 0 },
        { method: 'approve', reads: 0, writes: 1 },
      ];

      const optimized = estimator.optimizeStorageAccess(contractCalls);

      expect(optimized[0].optimized.parallelizable).toBe(true);
      expect(optimized[1].optimized.parallelizable).toBe(false);
    });

    it('should handle empty contract calls array', () => {
      const optimized = estimator.optimizeStorageAccess([]);
      expect(optimized).toEqual([]);
    });

    it('should preserve original call data', () => {
      const contractCalls = [{ method: 'transfer', reads: 5, writes: 3 }];

      const optimized = estimator.optimizeStorageAccess(contractCalls);

      expect(optimized[0].method).toBe('transfer');
      expect(optimized[0].reads).toBe(5);
      expect(optimized[0].writes).toBe(3);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle contract invocation with multiple parameters', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          result: {
            results: [
              {
                readBytes: 512,
                writeBytes: 1024,
                minResourceFee: 5000,
              },
            ],
          },
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const args = ['recipient', 1000, 'memo'];
      const estimate = await estimator.estimateContractInvocation(
        contractId,
        'complexOperation',
        args,
        testSourceAccount,
      );

      expect(estimate).toBeDefined();
      expect(estimate.estimatedFeeStroops).toBeGreaterThan(0);
    });

    it('should estimate fees for different contract operations', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          result: {
            results: [{ readBytes: 256, writeBytes: 512, minResourceFee: 1000 }],
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const operations = ['transfer', 'approve', 'burn', 'mint'];
      const estimates = await Promise.all(
        operations.map((op) =>
          estimator.estimateContractInvocation(contractId, op, [], testSourceAccount),
        ),
      );

      estimates.forEach((estimate) => {
        expect(estimate.estimatedFeeStroops).toBeGreaterThan(0);
      });
    });

    it('should handle fee estimation with zero storage', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          result: {
            results: [{ readBytes: 0, writeBytes: 0, minResourceFee: 100 }],
          },
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const estimate = await estimator.estimateContractInvocation(
        contractId,
        'view',
        [],
        testSourceAccount,
      );

      expect(estimate.contractDataReads).toBe(0);
      expect(estimate.contractDataWrites).toBe(0);
      expect(estimate.estimatedFeeStroops).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed RPC response', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ invalid: 'response' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const estimate = await estimator.estimateContractInvocation(
        contractId,
        'transfer',
        [],
        testSourceAccount,
      );

      // Should return default estimate
      expect(estimate.cpuInstructions).toBe(10000);
    });

    it('should handle fetch timeout', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Fetch timeout'));

      const estimate = await estimator.estimateContractInvocation(
        contractId,
        'transfer',
        [],
        testSourceAccount,
      );

      // Should return default estimate
      expect(estimate.cpuInstructions).toBe(10000);
    });

    it('should handle JSON parse errors in response', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const estimate = await estimator.estimateContractInvocation(
        contractId,
        'transfer',
        [],
        testSourceAccount,
      );

      // Should return default estimate
      expect(estimate.cpuInstructions).toBe(10000);
    });
  });

  describe('Fee calculation edge cases', () => {
    it('should handle very large byte counts', () => {
      const estimate = (estimator as any).calculateFeeEstimate({
        footprint: {
          readBytes: 1_000_000,
          writeBytes: 2_000_000,
        },
        estimatedFee: 100_000,
      });

      expect(estimate.memoryBytes).toBe(3_000_000);
      expect(estimate.cpuInstructions).toBeGreaterThan(0);
      expect(estimate.estimatedFeeStroops).toBeGreaterThan(0);
    });

    it('should handle rounding in fee conversion', () => {
      const estimate = (estimator as any).calculateFeeEstimate({
        footprint: { readBytes: 0, writeBytes: 0 },
        estimatedFee: 7_654_321,
      });

      // Should have exactly 7 decimal places
      expect(estimate.estimatedFeeXLM).toMatch(/^\d+\.\d{7}$/);
    });

    it('should ensure XLM fee is positive', () => {
      const estimate = (estimator as any).calculateFeeEstimate({
        footprint: { readBytes: 0, writeBytes: 0 },
        estimatedFee: 1,
      });

      const fee = parseFloat(estimate.estimatedFeeXLM);
      expect(fee).toBeGreaterThan(0);
    });
  });
});

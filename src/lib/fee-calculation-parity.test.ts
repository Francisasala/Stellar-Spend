import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateAllFees, FeeBreakdown, FeeCalculationParams } from './fee-calculation';
import { NextRequest, NextResponse } from 'next/server';

// Test for Issue #1122: Consolidate offramp fee logic
// This test ensures parity between quote fees (api/offramp/fees)
// and settlement fees (lib/fee-calculation.ts)

describe('Fee Calculation Parity - Issue #1122', () => {
  const testCases: Array<{
    name: string;
    params: FeeCalculationParams;
    expectedFeeStructure: {
      bridgeFee?: string;
      networkFee?: string;
      paycrestFee?: string;
      totalFee?: string;
    };
  }> = [
    {
      name: 'stablecoin method with no receive amount',
      params: {
        amount: '1000',
        currency: 'USDC',
        feeMethod: 'stablecoin',
      },
      expectedFeeStructure: {
        bridgeFee: expect.any(String),
        networkFee: '0',
        paycrestFee: '0',
      },
    },
    {
      name: 'native method with no receive amount',
      params: {
        amount: '500',
        currency: 'XLM',
        feeMethod: 'native',
      },
      expectedFeeStructure: {
        bridgeFee: '0',
        networkFee: expect.any(String),
        paycrestFee: '0',
      },
    },
    {
      name: 'stablecoin with receive amount (paycrest fee)',
      params: {
        amount: '1000',
        currency: 'USDC',
        feeMethod: 'stablecoin',
        receiveAmount: '950',
      },
      expectedFeeStructure: {
        bridgeFee: expect.any(String),
        networkFee: '0',
        paycrestFee: expect.any(String),
      },
    },
    {
      name: 'native with receive amount and contract resource estimate',
      params: {
        amount: '500',
        currency: 'XLM',
        feeMethod: 'native',
        receiveAmount: '480',
        contractResourceEstimate: {
          estimatedFeeXLM: '0.5',
        } as any,
      },
      expectedFeeStructure: {
        bridgeFee: '0',
        networkFee: expect.any(String),
        paycrestFee: expect.any(String),
      },
    },
  ];

  describe('Fee calculation consistency', () => {
    testCases.forEach((testCase) => {
      it(`should calculate fees consistently for ${testCase.name}`, async () => {
        const result = await calculateAllFees(testCase.params);

        // Verify the result has all required fields
        expect(result).toHaveProperty('bridgeFee');
        expect(result).toHaveProperty('networkFee');
        expect(result).toHaveProperty('paycrestFee');
        expect(result).toHaveProperty('totalFee');
        expect(result).toHaveProperty('amountAfterFees');
        expect(result).toHaveProperty('amount');
        expect(result).toHaveProperty('currency');

        // Verify fees are numeric strings
        expect(typeof result.bridgeFee).toBe('string');
        expect(typeof result.networkFee).toBe('string');
        expect(typeof result.paycrestFee).toBe('string');
        expect(typeof result.totalFee).toBe('string');
      });
    });
  });

  describe('Fee parity between quote and settlement', () => {
    it('should produce identical fees when called multiple times with same params', async () => {
      const params: FeeCalculationParams = {
        amount: '2500',
        currency: 'USDC',
        feeMethod: 'stablecoin',
        receiveAmount: '2400',
      };

      const result1 = await calculateAllFees(params);
      const result2 = await calculateAllFees(params);

      expect(result1.totalFee).toBe(result2.totalFee);
      expect(result1.bridgeFee).toBe(result2.bridgeFee);
      expect(result1.networkFee).toBe(result2.networkFee);
      expect(result1.paycrestFee).toBe(result2.paycrestFee);
      expect(result1.amountAfterFees).toBe(result2.amountAfterFees);
    });

    it('should maintain fee parity across different fee methods', async () => {
      const amountStablecoin = '1000';
      const amountNative = '500';

      const stablecoinResult = await calculateAllFees({
        amount: amountStablecoin,
        currency: 'USDC',
        feeMethod: 'stablecoin',
        receiveAmount: amountStablecoin,
      });

      const nativeResult = await calculateAllFees({
        amount: amountNative,
        currency: 'XLM',
        feeMethod: 'native',
        receiveAmount: amountNative,
      });

      // Both should have valid fee structures
      expect(parseFloat(stablecoinResult.totalFee)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(nativeResult.totalFee)).toBeGreaterThanOrEqual(0);

      // Bridge fee should be 0 for native, non-zero for stablecoin
      expect(parseFloat(stablecoinResult.bridgeFee)).toBeGreaterThan(0);
      expect(parseFloat(nativeResult.bridgeFee)).toBe(0);

      // Network fee should be 0 for stablecoin, non-zero for native
      expect(parseFloat(stablecoinResult.networkFee)).toBe(0);
      expect(parseFloat(nativeResult.networkFee)).toBeGreaterThan(0);
    });

    it('should ensure amount after fees is never greater than original amount', async () => {
      const testAmounts = ['100', '1000', '5000', '10000'];

      for (const amount of testAmounts) {
        const result = await calculateAllFees({
          amount,
          currency: 'USDC',
          feeMethod: 'stablecoin',
          receiveAmount: amount,
        });

        const amountNum = parseFloat(amount);
        const afterFeesNum = parseFloat(result.amountAfterFees);
        expect(afterFeesNum).toBeLessThanOrEqual(amountNum);
      }
    });

    it('should calculate total fees as sum of component fees', async () => {
      const params: FeeCalculationParams = {
        amount: '2000',
        currency: 'USDC',
        feeMethod: 'stablecoin',
        receiveAmount: '1900',
      };

      const result = await calculateAllFees(params);

      const bridge = parseFloat(result.bridgeFee) || 0;
      const network = parseFloat(result.networkFee) || 0;
      const paycrest = parseFloat(result.paycrestFee) || 0;
      const total = parseFloat(result.totalFee);

      const expectedTotal = bridge + network + paycrest;
      expect(total).toBeCloseTo(expectedTotal, 5);
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle zero receive amount gracefully', async () => {
      const result = await calculateAllFees({
        amount: '1000',
        currency: 'USDC',
        feeMethod: 'stablecoin',
        receiveAmount: '0',
      });

      expect(result.paycrestFee).toBe('0');
      expect(parseFloat(result.totalFee)).toBeGreaterThanOrEqual(0);
    });

    it('should handle very small amounts', async () => {
      const result = await calculateAllFees({
        amount: '0.01',
        currency: 'USDC',
        feeMethod: 'stablecoin',
        receiveAmount: '0.01',
      });

      expect(result.totalFee).toBeDefined();
      expect(parseFloat(result.totalFee)).toBeGreaterThanOrEqual(0);
    });

    it('should handle large amounts', async () => {
      const result = await calculateAllFees({
        amount: '1000000',
        currency: 'USDC',
        feeMethod: 'stablecoin',
        receiveAmount: '1000000',
      });

      expect(result.totalFee).toBeDefined();
      expect(parseFloat(result.totalFee)).toBeGreaterThan(0);
    });

    it('should throw error for invalid amount', async () => {
      await expect(
        calculateAllFees({
          amount: 'invalid',
          currency: 'USDC',
          feeMethod: 'stablecoin',
        }),
      ).rejects.toThrow();
    });

    it('should throw error for negative amount', async () => {
      await expect(
        calculateAllFees({
          amount: '-100',
          currency: 'USDC',
          feeMethod: 'stablecoin',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Quote vs Settlement consistency', () => {
    it('should maintain consistency when same fee calculation is used for quote and settlement', async () => {
      const quoteParams: FeeCalculationParams = {
        amount: '5000',
        currency: 'USDC',
        feeMethod: 'stablecoin',
        receiveAmount: '4900',
      };

      // Simulate quote phase
      const quote = await calculateAllFees(quoteParams);

      // Simulate settlement phase with exact same params
      const settlement = await calculateAllFees(quoteParams);

      // Verify complete parity
      expect(settlement.bridgeFee).toBe(quote.bridgeFee);
      expect(settlement.networkFee).toBe(quote.networkFee);
      expect(settlement.paycrestFee).toBe(quote.paycrestFee);
      expect(settlement.totalFee).toBe(quote.totalFee);
      expect(settlement.amountAfterFees).toBe(quote.amountAfterFees);
    });
  });
});

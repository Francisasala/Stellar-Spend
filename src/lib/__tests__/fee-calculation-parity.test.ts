import { describe, it, expect } from 'vitest';
import {
  calculateBridgeFee,
  calculateNetworkFee,
  calculatePaycrestFee,
  calculateAllFees,
} from '../fee-calculation';
import {
  FEE_CONSTANTS,
  calculateBasisPointsFee,
} from '@stellar-spend/shared';

describe('Fee Calculation Parity Test', () => {
  describe('Backend fee estimates match shared constants', () => {
    it('should calculate bridge fee correctly for stablecoin', () => {
      const amount = '1000';
      const fee = calculateBridgeFee(amount, 'stablecoin');
      const expectedFee = (1000 * FEE_CONSTANTS.STABLECOIN_FEE_PERCENTAGE) / 100;
      expect(parseFloat(fee)).toBeCloseTo(expectedFee, 5);
    });

    it('should not charge bridge fee for native XLM', () => {
      const amount = '1000';
      const fee = calculateBridgeFee(amount, 'native');
      expect(fee).toBe('0');
    });

    it('should calculate network fee correctly for native XLM', () => {
      const fee = calculateNetworkFee('native');
      expect(fee).toBe(FEE_CONSTANTS.NETWORK_FEE_XLM);
    });

    it('should not charge network fee for stablecoin', () => {
      const fee = calculateNetworkFee('stablecoin');
      expect(fee).toBe('0');
    });

    it('should calculate paycrest fee correctly', () => {
      const receiveAmount = '5000';
      const fee = calculatePaycrestFee(receiveAmount);
      const expectedFee = (5000 * FEE_CONSTANTS.PAYCREST_FEE_PERCENTAGE) / 100;
      expect(parseFloat(fee)).toBeCloseTo(expectedFee, 2);
    });

    it('should use basis points consistently', () => {
      const amount = 10_000_000; // 10M stroops
      const stabledFee = calculateBasisPointsFee(amount, FEE_CONSTANTS.STABLECOIN_FEE_BASIS_POINTS);
      const expectedFee = (amount * FEE_CONSTANTS.STABLECOIN_FEE_PERCENTAGE) / 100;
      expect(stabledFee).toBeCloseTo(expectedFee, 2);
    });
  });

  describe('Fee calculations maintain total consistency', () => {
    it('should calculate consistent totals across different amounts', async () => {
      const testCases = [
        { amount: '100', currency: 'USDC' },
        { amount: '1000', currency: 'USDC' },
        { amount: '10000', currency: 'USDC' },
      ];

      for (const testCase of testCases) {
        const breakdown = await calculateAllFees({
          amount: testCase.amount,
          currency: testCase.currency,
          feeMethod: 'stablecoin',
          receiveAmount: testCase.amount,
        });

        const bridgeFee = parseFloat(breakdown.bridgeFee);
        const paycrestFee = parseFloat(breakdown.paycrestFee);
        const totalFee = parseFloat(breakdown.totalFee);

        // Total should be sum of components
        expect(totalFee).toBeCloseTo(bridgeFee + paycrestFee, 5);
      }
    });

    it('should maintain parity between basis-point and percentage calculations', () => {
      const amount = 10_000_000;

      // Using percentage
      const percentageFee = (amount * FEE_CONSTANTS.STABLECOIN_FEE_PERCENTAGE) / 100;

      // Using basis points
      const basisPointsFee = calculateBasisPointsFee(amount, FEE_CONSTANTS.STABLECOIN_FEE_BASIS_POINTS);

      expect(basisPointsFee).toBeCloseTo(percentageFee, 2);
    });
  });

  describe('Edge cases are handled consistently', () => {
    it('should handle zero amounts', async () => {
      const breakdown = await calculateAllFees({
        amount: '0',
        currency: 'USDC',
        feeMethod: 'stablecoin',
        receiveAmount: '0',
      });

      expect(parseFloat(breakdown.bridgeFee)).toBeCloseTo(0, 5);
      expect(parseFloat(breakdown.paycrestFee)).toBeCloseTo(0, 2);
      expect(parseFloat(breakdown.totalFee)).toBeCloseTo(0, 5);
    });

    it('should handle maximum fee constraints', () => {
      // Verify max fee percentage doesn't exceed maximum basis points
      const maxFeeBP = FEE_CONSTANTS.MAX_FEE_BASIS_POINTS;
      const maxFeePercentage = FEE_CONSTANTS.MAX_FEE_PERCENTAGE;

      expect(maxFeePercentage).toBe(maxFeeBP / 100);
    });
  });
});

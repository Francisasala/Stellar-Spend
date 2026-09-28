import { describe, it, expect } from 'vitest';
import {
  FEE_CONSTANTS,
  calculateBasisPointsFee,
  percentageToBasisPoints,
  isValidBasisPoints,
} from './fee-constants';

describe('FEE_CONSTANTS', () => {
  it('exports stablecoin fee as 0.5% and 50 basis points', () => {
    expect(FEE_CONSTANTS.STABLECOIN_FEE_PERCENTAGE).toBe(0.5);
    expect(FEE_CONSTANTS.STABLECOIN_FEE_BASIS_POINTS).toBe(50);
    expect(FEE_CONSTANTS.STABLECOIN_FEE_PERCENTAGE * 100).toBe(FEE_CONSTANTS.STABLECOIN_FEE_BASIS_POINTS);
  });

  it('exports paycrest fee as 1.0% and 100 basis points', () => {
    expect(FEE_CONSTANTS.PAYCREST_FEE_PERCENTAGE).toBe(1.0);
    expect(FEE_CONSTANTS.PAYCREST_FEE_BASIS_POINTS).toBe(100);
    expect(FEE_CONSTANTS.PAYCREST_FEE_PERCENTAGE * 100).toBe(FEE_CONSTANTS.PAYCREST_FEE_BASIS_POINTS);
  });

  it('exports network fee constants in XLM and stroops', () => {
    expect(FEE_CONSTANTS.NETWORK_FEE_XLM).toBe('0.00001');
    expect(FEE_CONSTANTS.NETWORK_FEE_STROOPS).toBe(100);
  });

  it('exports max fee as 5% and 500 basis points', () => {
    expect(FEE_CONSTANTS.MAX_FEE_PERCENTAGE).toBe(5.0);
    expect(FEE_CONSTANTS.MAX_FEE_BASIS_POINTS).toBe(500);
    expect(FEE_CONSTANTS.MAX_FEE_PERCENTAGE * 100).toBe(FEE_CONSTANTS.MAX_FEE_BASIS_POINTS);
  });

  it('has readonly properties via as const', () => {
    expect(typeof FEE_CONSTANTS.STABLECOIN_FEE_PERCENTAGE).toBe('number');
    expect(typeof FEE_CONSTANTS.NETWORK_FEE_XLM).toBe('string');
  });
});

describe('calculateBasisPointsFee', () => {
  it('calculates fee for a numeric amount', () => {
    expect(calculateBasisPointsFee(1000, 50)).toBe(5);
  });

  it('calculates fee for a string amount', () => {
    expect(calculateBasisPointsFee('1000', 50)).toBe(5);
  });

  it('returns 0 for zero basis points', () => {
    expect(calculateBasisPointsFee(1000, 0)).toBe(0);
  });

  it('returns 0 for zero amount', () => {
    expect(calculateBasisPointsFee(0, 50)).toBe(0);
  });

  it('handles fractional amounts from string parsing', () => {
    const result = calculateBasisPointsFee('100.50', 100);
    expect(result).toBeCloseTo(1.005);
  });

  it('calculates 100% fee (10000 basis points)', () => {
    expect(calculateBasisPointsFee(500, 10000)).toBe(500);
  });

  it('calculates very small fee for 1 basis point', () => {
    expect(calculateBasisPointsFee(10000, 1)).toBe(1);
  });

  it('handles very large amounts', () => {
    const result = calculateBasisPointsFee(1_000_000_000, 50);
    expect(result).toBe(5_000_000);
  });
});

describe('percentageToBasisPoints', () => {
  it('converts 0.5% to 50 bp', () => {
    expect(percentageToBasisPoints(0.5)).toBe(50);
  });

  it('converts 1% to 100 bp', () => {
    expect(percentageToBasisPoints(1)).toBe(100);
  });

  it('converts 0% to 0 bp', () => {
    expect(percentageToBasisPoints(0)).toBe(0);
  });

  it('converts 5% to 500 bp', () => {
    expect(percentageToBasisPoints(5)).toBe(500);
  });

  it('converts 100% to 10000 bp', () => {
    expect(percentageToBasisPoints(100)).toBe(10000);
  });

  it('handles fractional percentages', () => {
    expect(percentageToBasisPoints(0.25)).toBe(25);
    expect(percentageToBasisPoints(0.01)).toBe(1);
  });
});

describe('isValidBasisPoints', () => {
  it('accepts 0', () => {
    expect(isValidBasisPoints(0)).toBe(true);
  });

  it('accepts 50 (stablecoin fee)', () => {
    expect(isValidBasisPoints(50)).toBe(true);
  });

  it('accepts 100 (paycrest fee)', () => {
    expect(isValidBasisPoints(100)).toBe(true);
  });

  it('accepts 500 (max fee)', () => {
    expect(isValidBasisPoints(500)).toBe(true);
  });

  it('rejects negative values', () => {
    expect(isValidBasisPoints(-1)).toBe(false);
  });

  it('rejects values above 500', () => {
    expect(isValidBasisPoints(501)).toBe(false);
    expect(isValidBasisPoints(10000)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(isValidBasisPoints(NaN)).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(isValidBasisPoints(Infinity)).toBe(false);
  });

  it('rejects non-finite values', () => {
    expect(isValidBasisPoints(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidBasisPoints(Number.NEGATIVE_INFINITY)).toBe(false);
  });
});

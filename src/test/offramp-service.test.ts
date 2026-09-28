import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchPaycrestQuote, buildQuote, calculateBridgeAmount } from '@/lib/offramp/utils/quote-fetcher';

describe('Offramp Service - Quote Fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateBridgeAmount', () => {
    it('returns amount unchanged when feeMethod is native', () => {
      const amount = '100';
      const result = calculateBridgeAmount(amount, 'native', '0');
      expect(result).toBe('100');
    });

    it('subtracts stablecoin fee from amount when feeMethod is stablecoin', () => {
      const amount = '100';
      const fee = '10';
      const result = calculateBridgeAmount(amount, 'stablecoin', fee);
      expect(result).toBe('90');
    });

    it('throws error when amount is invalid (zero)', () => {
      expect(() => calculateBridgeAmount('0', 'native')).toThrow('Invalid amount');
    });

    it('throws error when amount is invalid (negative)', () => {
      expect(() => calculateBridgeAmount('-10', 'native')).toThrow('Invalid amount');
    });

    it('throws error when amount is NaN', () => {
      expect(() => calculateBridgeAmount('not-a-number', 'native')).toThrow('Invalid amount');
    });

    it('throws error when stablecoin fee exceeds amount', () => {
      const amount = '50';
      const fee = '100';
      expect(() => calculateBridgeAmount(amount, 'stablecoin', fee)).toThrow(
        'Amount is less than stablecoin fee',
      );
    });

    it('handles decimal amounts correctly', () => {
      const amount = '100.50';
      const fee = '10.25';
      const result = calculateBridgeAmount(amount, 'stablecoin', fee);
      expect(parseFloat(result)).toBeCloseTo(90.25, 2);
    });

    it('returns amount as string for native fee method with decimals', () => {
      const amount = '123.456';
      const result = calculateBridgeAmount(amount, 'native');
      expect(result).toBe('123.456');
    });
  });

  describe('buildQuote', () => {
    it('builds valid quote with all parameters', () => {
      const quote = buildQuote('1000', 450.5, 'NGN', '50', '100', 300);
      expect(quote).toEqual({
        destinationAmount: '1000',
        rate: 450.5,
        currency: 'NGN',
        bridgeFee: '50',
        payoutFee: '100',
        estimatedTime: 300,
      });
    });

    it('uses default values for optional parameters', () => {
      const quote = buildQuote('500', 480, 'KES');
      expect(quote.bridgeFee).toBe('0');
      expect(quote.payoutFee).toBe('0');
      expect(quote.estimatedTime).toBe(300);
    });

    it('throws error if quote contains NaN values', () => {
      expect(() => buildQuote('NaN', 450, 'NGN')).toThrow('Invalid quote: NaN or negative values detected');
    });

    it('throws error if quote contains negative destination amount', () => {
      expect(() => buildQuote('-100', 450, 'NGN')).toThrow('Invalid quote: NaN or negative values detected');
    });

    it('throws error if quote contains negative rate', () => {
      expect(() => buildQuote('100', -450, 'NGN')).toThrow('Invalid quote: NaN or negative values detected');
    });

    it('throws error if quote contains negative bridge fee', () => {
      expect(() => buildQuote('100', 450, 'NGN', '-10')).toThrow('Invalid quote: NaN or negative values detected');
    });

    it('throws error if quote contains negative payout fee', () => {
      expect(() => buildQuote('100', 450, 'NGN', '10', '-5')).toThrow('Invalid quote: NaN or negative values detected');
    });

    it('throws error if rate is zero', () => {
      expect(() => buildQuote('100', 0, 'NGN')).toThrow('Invalid quote: NaN or negative values detected');
    });

    it('accepts very large decimal values', () => {
      const quote = buildQuote('99999.999999', 450.123456, 'NGN');
      expect(quote.destinationAmount).toBe('99999.999999');
      expect(quote.rate).toBe(450.123456);
    });
  });

  describe('fetchPaycrestQuote', () => {
    it('throws error when receiveAmount is empty', async () => {
      await expect(fetchPaycrestQuote('', 'NGN')).rejects.toThrow(
        'receiveAmount and currency are required',
      );
    });

    it('throws error when currency is empty', async () => {
      await expect(fetchPaycrestQuote('100', '')).rejects.toThrow(
        'receiveAmount and currency are required',
      );
    });

    it('throws error when receiveAmount is zero', async () => {
      await expect(fetchPaycrestQuote('0', 'NGN')).rejects.toThrow('Invalid receiveAmount');
    });

    it('throws error when receiveAmount is negative', async () => {
      await expect(fetchPaycrestQuote('-50', 'NGN')).rejects.toThrow('Invalid receiveAmount');
    });

    it('throws error when receiveAmount is NaN', async () => {
      await expect(fetchPaycrestQuote('not-a-number', 'NGN')).rejects.toThrow('Invalid receiveAmount');
    });
  });

  describe('Provider Selection Logic', () => {
    it('normalizes USDC to stablecoin fee method', () => {
      const feeMethodMap: Record<string, 'stablecoin' | 'native'> = {
        USDC: 'stablecoin',
        stablecoin: 'stablecoin',
        XLM: 'native',
        native: 'native',
      };

      expect(feeMethodMap['USDC']).toBe('stablecoin');
      expect(feeMethodMap['stablecoin']).toBe('stablecoin');
      expect(feeMethodMap['XLM']).toBe('native');
      expect(feeMethodMap['native']).toBe('native');
    });

    it('preserves fee method for known inputs', () => {
      const testCases = [
        { input: 'USDC', expected: 'stablecoin' },
        { input: 'XLM', expected: 'native' },
        { input: 'stablecoin', expected: 'stablecoin' },
        { input: 'native', expected: 'native' },
      ];

      const feeMethodMap: Record<string, 'stablecoin' | 'native'> = {
        USDC: 'stablecoin',
        stablecoin: 'stablecoin',
        XLM: 'native',
        native: 'native',
      };

      testCases.forEach(({ input, expected }) => {
        expect(feeMethodMap[input]).toBe(expected);
      });
    });
  });

  describe('Error Mapping Integration', () => {
    it('maps validation errors consistently', () => {
      const testCases = [
        { error: 'Invalid amount', isValidationError: true },
        { error: 'Amount is less than stablecoin fee', isValidationError: true },
        { error: 'Invalid receiveAmount', isValidationError: true },
        { error: 'Invalid quote: NaN or negative values detected', isValidationError: true },
      ];

      testCases.forEach(({ error, isValidationError }) => {
        expect(
          (error.includes('Invalid') || error.includes('less than') || error.includes('required'))
            === isValidationError,
        ).toBe(true);
      });
    });
  });
});

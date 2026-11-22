import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateAmountLegacy,
  validateMinAmountLegacy,
  validateMaxAmountLegacy,
  validateAmountRangeLegacy,
} from './amount';
import { ValidationService } from './service';

// Mock ValidationService
vi.mock('./service', () => ({
  ValidationService: {
    validateAmount: vi.fn(),
    validateMinAmount: vi.fn(),
    validateMaxAmount: vi.fn(),
    validateAmountRange: vi.fn(),
  },
}));

describe('amount validators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateAmountLegacy', () => {
    it('should return valid result for valid amount', () => {
      (ValidationService.validateAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateAmountLegacy('100.50');

      expect(result).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('should return invalid result for invalid amount', () => {
      (ValidationService.validateAmount as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Invalid amount format', code: 'INVALID_AMOUNT' }],
      });

      const result = validateAmountLegacy('invalid');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle empty string', () => {
      (ValidationService.validateAmount as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Amount is required', code: 'REQUIRED' }],
      });

      const result = validateAmountLegacy('');

      expect(result.valid).toBe(false);
    });

    it('should handle zero amount', () => {
      (ValidationService.validateAmount as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Amount must be greater than 0', code: 'MIN_AMOUNT' }],
      });

      const result = validateAmountLegacy('0');

      expect(result.valid).toBe(false);
    });

    it('should handle negative amount', () => {
      (ValidationService.validateAmount as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Amount must be positive', code: 'POSITIVE_AMOUNT' }],
      });

      const result = validateAmountLegacy('-50');

      expect(result.valid).toBe(false);
    });

    it('should handle very large amounts', () => {
      (ValidationService.validateAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateAmountLegacy('99999999999.99');

      expect(result.valid).toBe(true);
    });

    it('should handle amounts with many decimal places', () => {
      (ValidationService.validateAmount as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Too many decimal places', code: 'DECIMAL_PLACES' }],
      });

      const result = validateAmountLegacy('100.123456789');

      expect(result.valid).toBe(false);
    });
  });

  describe('validateMinAmountLegacy', () => {
    it('should return valid when amount meets minimum', () => {
      (ValidationService.validateMinAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateMinAmountLegacy('100', 50);

      expect(result).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('should return invalid when amount is below minimum', () => {
      (ValidationService.validateMinAmount as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Amount is below minimum', code: 'MIN_AMOUNT' }],
      });

      const result = validateMinAmountLegacy('30', 50);

      expect(result.valid).toBe(false);
    });

    it('should return valid when amount equals minimum', () => {
      (ValidationService.validateMinAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateMinAmountLegacy('50', 50);

      expect(result.valid).toBe(true);
    });

    it('should handle negative minimum', () => {
      (ValidationService.validateMinAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateMinAmountLegacy('0', -10);

      expect(result.valid).toBe(true);
    });

    it('should handle zero as minimum', () => {
      (ValidationService.validateMinAmount as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Amount must be greater than 0', code: 'MIN_AMOUNT' }],
      });

      const result = validateMinAmountLegacy('0', 0);

      expect(result.valid).toBe(false);
    });

    it('should handle decimal minimum threshold', () => {
      (ValidationService.validateMinAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateMinAmountLegacy('10.50', 10.25);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateMaxAmountLegacy', () => {
    it('should return valid when amount is below maximum', () => {
      (ValidationService.validateMaxAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateMaxAmountLegacy('100', 200);

      expect(result).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('should return invalid when amount exceeds maximum', () => {
      (ValidationService.validateMaxAmount as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Amount exceeds maximum', code: 'MAX_AMOUNT' }],
      });

      const result = validateMaxAmountLegacy('300', 200);

      expect(result.valid).toBe(false);
    });

    it('should return valid when amount equals maximum', () => {
      (ValidationService.validateMaxAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateMaxAmountLegacy('200', 200);

      expect(result.valid).toBe(true);
    });

    it('should handle very high maximum threshold', () => {
      (ValidationService.validateMaxAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateMaxAmountLegacy('1000', 999999999);

      expect(result.valid).toBe(true);
    });

    it('should handle decimal maximum threshold', () => {
      (ValidationService.validateMaxAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateMaxAmountLegacy('99.99', 100.0);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateAmountRangeLegacy', () => {
    it('should return valid when amount is within range', () => {
      (ValidationService.validateAmountRange as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateAmountRangeLegacy('150', 100, 200);

      expect(result).toEqual({
        valid: true,
        errors: [],
      });
    });

    it('should return invalid when amount is below range', () => {
      (ValidationService.validateAmountRange as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Amount is below minimum', code: 'MIN_AMOUNT' }],
      });

      const result = validateAmountRangeLegacy('50', 100, 200);

      expect(result.valid).toBe(false);
    });

    it('should return invalid when amount exceeds range', () => {
      (ValidationService.validateAmountRange as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Amount exceeds maximum', code: 'MAX_AMOUNT' }],
      });

      const result = validateAmountRangeLegacy('250', 100, 200);

      expect(result.valid).toBe(false);
    });

    it('should return valid when amount equals minimum boundary', () => {
      (ValidationService.validateAmountRange as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateAmountRangeLegacy('100', 100, 200);

      expect(result.valid).toBe(true);
    });

    it('should return valid when amount equals maximum boundary', () => {
      (ValidationService.validateAmountRange as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateAmountRangeLegacy('200', 100, 200);

      expect(result.valid).toBe(true);
    });

    it('should handle inverted range (min > max)', () => {
      (ValidationService.validateAmountRange as any).mockReturnValue({
        valid: false,
        errors: [{ message: 'Invalid range', code: 'INVALID_RANGE' }],
      });

      const result = validateAmountRangeLegacy('150', 200, 100);

      expect(result.valid).toBe(false);
    });

    it('should handle zero-width range', () => {
      (ValidationService.validateAmountRange as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateAmountRangeLegacy('100', 100, 100);

      expect(result.valid).toBe(true);
    });

    it('should handle decimal ranges', () => {
      (ValidationService.validateAmountRange as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateAmountRangeLegacy('50.50', 10.25, 99.99);

      expect(result.valid).toBe(true);
    });
  });

  describe('Error scenarios', () => {
    it('should always return array for errors even when undefined from service', () => {
      (ValidationService.validateAmount as any).mockReturnValue({
        valid: true,
        errors: undefined,
      });

      const result = validateAmountLegacy('100');

      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle service returning multiple errors', () => {
      (ValidationService.validateAmount as any).mockReturnValue({
        valid: false,
        errors: [
          { message: 'Invalid format', code: 'FORMAT' },
          { message: 'Too large', code: 'MAX' },
        ],
      });

      const result = validateAmountLegacy('not-a-number');

      expect(result.errors).toHaveLength(2);
    });

    it('should handle service throwing error', () => {
      (ValidationService.validateAmount as any).mockImplementation(() => {
        throw new Error('Service error');
      });

      expect(() => {
        validateAmountLegacy('100');
      }).toThrow();
    });
  });
});

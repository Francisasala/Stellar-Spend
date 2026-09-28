import { createValidationError, type ValidationResult } from './types';
import { ValidationService } from './service';

const SUPPORTED_CURRENCIES = ['NGN', 'KES', 'GHS', 'UGX', 'ZAR', 'GBP', 'USD', 'EUR'];

export function validateCurrencyLegacy(currency: string): ValidationResult {
  const result = ValidationService.validateCurrencyCode(currency);
  return {
    valid: result.valid,
    errors: result.errors || [],
  };
}

export function validateTokenLegacy(token: string): ValidationResult {
  const result = {
    valid: ['USDC', 'USDT'].includes(token.toUpperCase()),
    errors: !['USDC', 'USDT'].includes(token.toUpperCase())
      ? [createValidationError('token', `Token ${token} is not supported`)]
      : [],
  };
  return {
    valid: result.valid,
    errors: result.errors || [],
  };
}

export function getSupportedCurrencies(): string[] {
  return [...SUPPORTED_CURRENCIES];
}

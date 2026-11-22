// src/lib/validation/bank-account.ts

import type { ValidationResult } from './rules';

export type { ValidationResult } from './rules';

/**
 * Supported bank account field types.
 */
export type BankFieldType =
  | 'accountNumber'
  | 'routingNumber'
  | 'iban'
  | 'accountHolder'
  | 'bankName';

/**
 * A country-specific validator function. Returns a ValidationResult.
 */
export type CountryValidator = (value: string) => ValidationResult;

const countryValidators: Record<string, CountryValidator> = {};

/**
 * Register a country-specific validator for a given country code.
 * Country codes are normalized to upper-case.
 */
export function registerCountryValidator(countryCode: string, validator: CountryValidator): void {
  if (!countryCode) {
    throw new Error('countryCode is required');
  }
  if (typeof validator !== 'function') {
    throw new Error('validator must be a function');
  }
  countryValidators[countryCode.toUpperCase()] = validator;
}

/**
 * Retrieve a country-specific validator for a given country code.
 * Returns undefined if none is registered.
 */
export function getCountryValidator(countryCode: string): CountryValidator | undefined {
  if (!countryCode) {
    return undefined;
  }
  return countryValidators[countryCode.toUpperCase()];
}

/**
 * Clear all registered country validators. Primarily useful for tests.
 */
export function clearCountryValidators(): void {
  for (const key of Object.keys(countryValidators)) {
    delete countryValidators[key];
  }
}

function ok(): ValidationResult {
  return { valid: true };
}

function fail(message: string): ValidationResult {
  return { valid: false, message };
}

/**
 * Validate a bank account number.
 * Accepts 4-17 digits, optionally separated by spaces or hyphens.
 */
export function validateAccountNumber(value: string): ValidationResult {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return fail('Account number is required');
  }
  const normalized = trimmed.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(normalized)) {
    return fail('Account number must contain only digits');
  }
  if (normalized.length < 4 || normalized.length > 17) {
    return fail('Account number must be between 4 and 17 digits');
  }
  return ok();
}

/**
 * Validate a routing number (US ABA routing number).
 * Must be exactly 9 digits and pass the ABA checksum.
 */
export function validateRoutingNumber(value: string): ValidationResult {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return fail('Routing number is required');
  }
  const normalized = trimmed.replace(/[\s-]/g, '');
  if (!/^\d{9}$/.test(normalized)) {
    return fail('Routing number must be exactly 9 digits');
  }
  const digits = normalized.split('').map((d) => parseInt(d, 10));
  const checksum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    (digits[2] + digits[5] + digits[8]);
  if (checksum % 10 !== 0) {
    return fail('Routing number is invalid');
  }
  return ok();
}

/**
 * Validate an IBAN.
 * Performs basic structural checks and the mod-97 checksum.
 */
export function validateIBAN(value: string): ValidationResult {
  const trimmed = (value ?? '').replace(/\s+/g, '').toUpperCase();
  if (!trimmed) {
    return fail('IBAN is required');
  }
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(trimmed)) {
    return fail('IBAN format is invalid');
  }
  if (trimmed.length < 15 || trimmed.length > 34) {
    return fail('IBAN length is invalid');
  }
  const rearranged = trimmed.slice(4) + trimmed.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  // Compute mod 97 in chunks to avoid precision issues.
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = numeric.slice(i, i + 7);
    remainder = parseInt(String(remainder) + chunk, 10) % 97;
  }
  if (remainder !== 1) {
    return fail('IBAN checksum is invalid');
  }
  return ok();
}

/**
 * Validate a bank field based on its type. Optionally applies a
 * country-specific validator when a country code is provided.
 */
export function validateBankField(
  type: BankFieldType,
  value: string,
  countryCode?: string,
): ValidationResult {
  if (countryCode) {
    const countryValidator = getCountryValidator(countryCode);
    if (countryValidator) {
      const result = countryValidator(value ?? '');
      if (!result.valid) {
        return result;
      }
    }
  }

  switch (type) {
    case 'accountNumber':
      return validateAccountNumber(value);
    case 'routingNumber':
      return validateRoutingNumber(value);
    case 'iban':
      return validateIBAN(value);
    case 'accountHolder': {
      const trimmed = (value ?? '').trim();
      if (!trimmed) {
        return fail('Account holder name is required');
      }
      if (trimmed.length > 100) {
        return fail('Account holder name is too long');
      }
      return ok();
    }
    case 'bankName': {
      const trimmed = (value ?? '').trim();
      if (!trimmed) {
        return fail('Bank name is required');
      }
      if (trimmed.length > 100) {
        return fail('Bank name is too long');
      }
      return ok();
    }
    default:
      return fail('Unknown bank field type');
  }
}

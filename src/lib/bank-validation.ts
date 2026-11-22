/**
 * Bank account validation utilities.
 *
 * This module is a thin backwards-compatible facade. The actual validation
 * logic (generic validators, config-driven per-country rules and the
 * pluggable country-validator registry) now lives in the shared
 * `@/lib/validation/bank-account` module. Existing imports from
 * `@/lib/bank-validation` keep working unchanged.
 */

export {
  validateAccountNumber,
  validateRoutingNumber,
  validateIBAN,
  validateBankField,
  registerCountryValidator,
  getCountryValidator,
} from '@/lib/validation/bank-account';

export type { BankFieldType, CountryValidatorFn } from '@/lib/validation/bank-account';

export type { ValidationResult } from '@/lib/validation/rules';

import { describe, it, expect } from 'vitest';
import {
  CURRENCY_SYMBOLS,
  getCurrencySymbol,
  formatFiatAmount,
  formatUsdcAmount,
  formatNumber,
  formatDateTime,
  formatShortDateTime,
  truncateHash,
} from './format';

describe('getCurrencySymbol', () => {
  it('returns the mapped symbol for known currencies', () => {
    expect(getCurrencySymbol('NGN')).toBe('₦');
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('eur')).toBe('€');
  });

  it('falls back to the uppercased code for unknown currencies', () => {
    expect(getCurrencySymbol('xyz')).toBe('XYZ');
  });

  it('exposes the symbol map used internally', () => {
    expect(CURRENCY_SYMBOLS.NGN).toBe('₦');
  });
});

describe('formatFiatAmount', () => {
  it('formats NGN as symbol + grouped integer', () => {
    expect(formatFiatAmount(1234567, 'NGN')).toBe('₦1,234,567');
  });

  it('formats USD using Intl currency style', () => {
    expect(formatFiatAmount(1234.5, 'USD')).toBe('$1,234.50');
  });

  it('accepts string input', () => {
    expect(formatFiatAmount('1234.5', 'USD')).toBe('$1,234.50');
  });

  it('returns an em dash for invalid numeric input', () => {
    expect(formatFiatAmount('not-a-number', 'USD')).toBe('—');
  });

  it('falls back to symbol + fixed decimals for unsupported ISO codes', () => {
    expect(formatFiatAmount(10, 'XYZ')).toBe('XYZ 10.00');
  });
});

describe('formatUsdcAmount', () => {
  it('formats with default 2-6 fraction digits', () => {
    expect(formatUsdcAmount(1234.5)).toBe('1,234.50');
  });

  it('shows up to 6 fraction digits when present', () => {
    expect(formatUsdcAmount(1234.123456)).toBe('1,234.123456');
  });

  it('accepts string input', () => {
    expect(formatUsdcAmount('1000')).toBe('1,000.00');
  });

  it('returns 0.00 for invalid input', () => {
    expect(formatUsdcAmount('not-a-number')).toBe('0.00');
  });

  it('respects custom fraction digit options', () => {
    expect(formatUsdcAmount(1, { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe('1');
  });
});

describe('formatNumber', () => {
  it('formats with grouped digits', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('respects passed-through Intl options', () => {
    expect(formatNumber(1234.567, { maximumFractionDigits: 1 })).toBe('1,234.6');
  });
});

describe('formatDateTime', () => {
  it('accepts a timestamp, Date, or ISO string without throwing', () => {
    const ts = Date.parse('2026-06-28T22:00:00.000Z');
    expect(typeof formatDateTime(ts)).toBe('string');
    expect(typeof formatDateTime(new Date(ts))).toBe('string');
    expect(typeof formatDateTime('2026-06-28T22:00:00.000Z')).toBe('string');
  });
});

describe('formatShortDateTime', () => {
  it('includes the month, day, and year', () => {
    const ts = Date.parse('2026-06-28T22:00:00.000Z');
    const result = formatShortDateTime(ts);
    expect(result).toContain('2026');
    expect(result).toMatch(/Jun/);
  });
});

describe('truncateHash', () => {
  it('truncates long hashes to head...tail', () => {
    expect(truncateHash('abcdef1234567890abcdef')).toBe('abcdef...abcdef');
  });

  it('returns short hashes unchanged', () => {
    expect(truncateHash('abc123')).toBe('abc123');
  });

  it('returns an em dash for empty input', () => {
    expect(truncateHash('')).toBe('—');
  });

  it('respects custom head/tail lengths', () => {
    expect(truncateHash('abcdefghijklmnop', 3, 3)).toBe('abc...nop');
  });
});

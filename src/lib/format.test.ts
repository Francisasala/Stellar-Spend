import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  DateFormatter,
  defaultFormatter,
  formatTransaction,
  formatTransactionDate,
  CURRENCY_SYMBOLS,
  getCurrencySymbol,
  formatFiatAmount,
  formatUsdcAmount,
  formatNumber,
  formatDateTime,
  formatShortDateTime,
  truncateHash,
} from './format';
import * as datetimeModule from './datetime';

vi.mock('./datetime', async (importOriginal) => {
  const actual = await importOriginal<typeof datetimeModule>();
  return {
    ...actual,
    formatUtc: vi.fn((iso: string) => `formatted-utc-${iso}`),
    formatDate: vi.fn((iso: string) => `formatted-date-${iso}`),
    parseUtc: vi.fn((iso: string) => new Date(iso)),
  };
});

const mockFormatUtc = datetimeModule.formatUtc as unknown as Mock;
const mockFormatDate = datetimeModule.formatDate as unknown as Mock;
const mockParseUtc = datetimeModule.parseUtc as unknown as Mock;

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

describe('DateFormatter and transaction date helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DateFormatter', () => {
    it('should create a DateFormatter with default config', () => {
      const formatter = new DateFormatter();
      expect(formatter).toBeDefined();
    });

    it('should create a DateFormatter with custom config', () => {
      const formatter = new DateFormatter({
        locale: 'fr-FR',
        timeZone: 'Europe/Paris',
      });
      expect(formatter).toBeDefined();
    });

    describe('formatTimestamp', () => {
      it('should format a timestamp using formatUtc', () => {
        const formatter = new DateFormatter();
        const iso = '2024-01-15T10:30:00Z';

        const result = formatter.formatTimestamp(iso);

        expect(mockFormatUtc).toHaveBeenCalledWith(iso, 'en-US', 'UTC');
        expect(result).toBe('formatted-utc-2024-01-15T10:30:00Z');
      });

      it('should use custom locale and timezone', () => {
        const formatter = new DateFormatter({
          locale: 'de-DE',
          timeZone: 'Europe/Berlin',
        });
        const iso = '2024-01-15T10:30:00Z';

        formatter.formatTimestamp(iso);

        expect(mockFormatUtc).toHaveBeenCalledWith(iso, 'de-DE', 'Europe/Berlin');
      });
    });

    describe('formatDateOnly', () => {
      it('should format a date only using formatDate', () => {
        const formatter = new DateFormatter();
        const iso = '2024-01-15T10:30:00Z';

        const result = formatter.formatDateOnly(iso);

        expect(mockFormatDate).toHaveBeenCalledWith(iso, 'en-US', 'UTC');
        expect(result).toBe('formatted-date-2024-01-15T10:30:00Z');
      });
    });

    describe('formatRelative', () => {
      it('should return "just now" for times less than 60 seconds old', () => {
        const formatter = new DateFormatter();
        const now = new Date();
        const pastDate = new Date(now.getTime() - 30 * 1000);
        const iso = pastDate.toISOString();

        mockParseUtc.mockReturnValue(pastDate);

        const result = formatter.formatRelative(iso);

        expect(result).toBe('just now');
      });

      it('should return minutes for times less than 60 minutes old', () => {
        const formatter = new DateFormatter();
        const now = new Date();
        const pastDate = new Date(now.getTime() - 30 * 60 * 1000);
        const iso = pastDate.toISOString();

        mockParseUtc.mockReturnValue(pastDate);

        const result = formatter.formatRelative(iso);

        expect(result).toBe('30m ago');
      });

      it('should return hours for times less than 24 hours old', () => {
        const formatter = new DateFormatter();
        const now = new Date();
        const pastDate = new Date(now.getTime() - 5 * 60 * 60 * 1000);
        const iso = pastDate.toISOString();

        mockParseUtc.mockReturnValue(pastDate);

        const result = formatter.formatRelative(iso);

        expect(result).toBe('5h ago');
      });

      it('should return days for times less than 7 days old', () => {
        const formatter = new DateFormatter();
        const now = new Date();
        const pastDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const iso = pastDate.toISOString();

        mockParseUtc.mockReturnValue(pastDate);

        const result = formatter.formatRelative(iso);

        expect(result).toBe('3d ago');
      });

      it('should return formatted date for times 7+ days old', () => {
        const formatter = new DateFormatter();
        const now = new Date();
        const pastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
        const iso = pastDate.toISOString();

        mockParseUtc.mockReturnValue(pastDate);
        mockFormatDate.mockReturnValue('Jan 05, 2024');

        const result = formatter.formatRelative(iso);

        expect(result).toBe('Jan 05, 2024');
      });
    });

    describe('formatCompact', () => {
      it('should format as compact date', () => {
        const formatter = new DateFormatter();
        const iso = '2024-01-15T10:30:00Z';
        const date = new Date(iso);

        mockParseUtc.mockReturnValue(date);

        const result = formatter.formatCompact(iso);

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('formatRange', () => {
      it('should format a date range', () => {
        const formatter = new DateFormatter();
        const fromIso = '2024-01-01T00:00:00Z';
        const toIso = '2024-01-31T23:59:59Z';

        mockFormatDate.mockImplementation((iso) => {
          if (iso === fromIso) return 'Jan 01, 2024';
          if (iso === toIso) return 'Jan 31, 2024';
          return iso;
        });

        const result = formatter.formatRange(fromIso, toIso);

        expect(result).toBe('Jan 01, 2024 - Jan 31, 2024');
      });
    });
  });

  describe('Module-level functions', () => {
    describe('formatTransaction', () => {
      it('should format a transaction timestamp', () => {
        const iso = '2024-01-15T10:30:00Z';

        formatTransaction(iso);

        expect(mockFormatUtc).toHaveBeenCalled();
      });

      it('should use provided timezone', () => {
        const iso = '2024-01-15T10:30:00Z';

        formatTransaction(iso, 'America/New_York');

        expect(mockFormatUtc).toHaveBeenCalledWith(iso, 'en-US', 'America/New_York');
      });
    });

    describe('formatTransactionDate', () => {
      it('should format transaction date only', () => {
        const iso = '2024-01-15T10:30:00Z';

        formatTransactionDate(iso);

        expect(mockFormatDate).toHaveBeenCalled();
      });

      it('should use provided timezone', () => {
        const iso = '2024-01-15T10:30:00Z';

        formatTransactionDate(iso, 'Europe/London');

        expect(mockFormatDate).toHaveBeenCalledWith(iso, 'en-US', 'Europe/London');
      });
    });
  });

  describe('defaultFormatter', () => {
    it('should export a default formatter instance', () => {
      expect(defaultFormatter).toBeInstanceOf(DateFormatter);
    });
  });
});

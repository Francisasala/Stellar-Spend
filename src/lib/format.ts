/**
 * Shared currency/number/date formatting helpers.
 *
 * Consolidates logic that was previously duplicated across
 * src/app/history/format.ts, src/components/right-panel/types.ts,
 * src/components/form-card/types.ts, and several inline `toLocaleString()`
 * call sites.
 */

export const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  KES: 'KSh',
  GHS: '₵',
  ZAR: 'R',
};

/** Return the display symbol for an ISO currency code, falling back to the code itself. */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency.toUpperCase();
}

const NGN_FORMATTER = new Intl.NumberFormat('en-NG', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a fiat amount with its currency symbol/code.
 * NGN uses a symbol + grouped integer (no ISO currency support in Intl for NGN
 * display conventions used elsewhere in the app); other currencies use
 * `Intl.NumberFormat` currency style.
 */
export function formatFiatAmount(value: string | number, currency: string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';

  const code = currency.toUpperCase();
  const symbol = getCurrencySymbol(currency);

  if (code === 'NGN') {
    return `${symbol}${NGN_FORMATTER.format(num)}`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${symbol} ${num.toFixed(2)}`;
  }
}

/** Format a USDC (or other stablecoin) amount with grouped digits. */
export function formatUsdcAmount(
  value: string | number,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  const { minimumFractionDigits = 2, maximumFractionDigits = 6 } = options;
  return num.toLocaleString('en-US', { minimumFractionDigits, maximumFractionDigits });
}

/** Format a plain number with grouped digits (e.g. FX rates, alert prices). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat('en-US', options).format(value);
}

/** Format a timestamp (ms or Date) as a full date + time string, e.g. "Jun 28, 2026, 10:00 PM". */
export function formatDateTime(value: number | Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('en-US');
}

/** Format a timestamp (ms) as a short date + time, e.g. "Jun 28, 2026, 10:00 PM". */
export function formatShortDateTime(value: number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Truncate a hash/address for compact display, e.g. "abcdef...123456". */
export function truncateHash(hash: string, headLength = 6, tailLength = 6): string {
  if (!hash || hash.length <= headLength + tailLength) return hash || '—';
  return `${hash.slice(0, headLength)}...${hash.slice(-tailLength)}`;
}

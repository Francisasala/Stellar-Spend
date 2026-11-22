import type { Language } from './types';

/** Maps app language codes to BCP-47 locales for Intl formatting. */
export const LOCALE_MAP: Record<Language, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  zh: 'zh-CN',
  ar: 'ar-SA',
  pt: 'pt-PT',
  sw: 'sw-KE',
};

export function localeFor(language: Language): string {
  return LOCALE_MAP[language] ?? 'en-US';
}

export function formatDate(
  date: Date | number,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}

export function formatNumber(
  amount: number,
  language: Language,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(localeFor(language), options).format(amount);
}

export function formatCurrencyAmount(amount: number, currency: string, language: Language): string {
  try {
    return new Intl.NumberFormat(localeFor(language), {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown/unsupported ISO currency code — fall back to a plain number + code.
    return `${formatNumber(amount, language)} ${currency}`;
  }
}

/**
 * Formats a date using only date fields (no time). Useful for localized
 * date-only values such as due dates or deadlines introduced by extraction.
 */
export function formatDateOnly(
  date: Date | number,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(date);
}

/**
 * Formats a date using only time fields. Useful for localized time-only
 * values such as timestamps or durations introduced by extraction.
 */
export function formatTimeOnly(
  date: Date | number,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(date);
}

/**
 * Formats a number as a percentage. Accepts a fraction (0.25 => 25%) by
 * default; pass `isFraction: false` to treat the input as already scaled.
 */
export function formatPercent(
  value: number,
  language: Language,
  options?: Intl.NumberFormatOptions & { isFraction?: boolean },
): string {
  const { isFraction = true, ...numberOptions } = options ?? {};
  const scaled = isFraction ? value : value / 100;
  return new Intl.NumberFormat(localeFor(language), {
    style: 'percent',
    maximumFractionDigits: 1,
    ...numberOptions,
  }).format(scaled);
}

/**
 * Formats a relative time (e.g. "3 days ago") using Intl.RelativeTimeFormat.
 * `value` is the offset in `unit` units relative to now (negative = past).
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  language: Language,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  return new Intl.RelativeTimeFormat(localeFor(language), {
    numeric: 'auto',
    ...options,
  }).format(value, unit);
}

/**
 * Formats a plain list of items using locale-aware list separators
 * (e.g. "a, b, and c"). Useful for localized enumerations in messages.
 */
export function formatList(
  items: readonly string[],
  language: Language,
  options?: Intl.ListFormatOptions,
): string {
  return new Intl.ListFormat(localeFor(language), {
    style: 'long',
    type: 'conjunction',
    ...options,
  }).format(items);
}

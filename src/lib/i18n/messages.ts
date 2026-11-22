import { i18n } from './i18n';

/**
 * Standalone translation helpers backed by the global `i18n` singleton.
 * Prefer `useI18n()` inside React components; these exist for non-component
 * call sites (module-level data, utilities) and for backwards-compatible
 * imports from `@/lib/i18n`.
 */

function interpolate(message: string, values?: Record<string, string | number>): string {
  if (!values) {
    return message;
  }
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    message,
  );
}

/** Translate a dot-separated key, optionally interpolating `{placeholder}` values. */
export function t(key: string, values?: Record<string, string | number>): string {
  return interpolate(i18n.t(key), values);
}

/** Alias of {@link t} for call sites that prefer the `translate` name. */
export const translate = t;

/** Resolve a key, returning `undefined` when the key does not exist. */
export function getMessage(key: string): string | undefined {
  const resolved = i18n.t(key);
  return resolved === key ? undefined : resolved;
}

/** Type guard for error-like values carrying a non-empty `message` string. */
export function hasMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    (error as { message: string }).message.length > 0
  );
}

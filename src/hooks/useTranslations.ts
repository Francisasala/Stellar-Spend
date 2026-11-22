'use client';

import { useI18n } from '@/lib/i18n';

/**
 * Backwards-compatible alias for {@link useI18n}.
 *
 * Older call sites import `useTranslations` from `@/hooks/useTranslations`;
 * both return the same `{ t, translate, ... }` i18n context value.
 */
export function useTranslations() {
  return useI18n();
}

export default useTranslations;

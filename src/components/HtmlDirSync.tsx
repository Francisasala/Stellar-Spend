'use client';

import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n/provider';

/** Text direction values for the <html> element's dir attribute. */
export const DIRECTION_RTL = 'rtl';
export const DIRECTION_LTR = 'ltr';

/** Syncs the <html> element's lang and dir attributes with the active language. */
export function HtmlDirSync() {
  const { language, isRTL } = useI18n();

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRTL ? DIRECTION_RTL : DIRECTION_LTR;
  }, [language, isRTL]);

  return null;
}

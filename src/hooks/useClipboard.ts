import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

export function useClipboard(timeout = 2000) {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      if (!navigator?.clipboard) {
        logger.warn('clipboard.unsupported');
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), timeout);
        return true;
      } catch (error) {
        logger.warn('clipboard.copy_failed', {}, error);
        setIsCopied(false);
        return false;
      }
    },
    [timeout],
  );

  return { isCopied, copy };
}

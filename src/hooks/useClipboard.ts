import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

export interface UseClipboardResult {
  isCopied: boolean;
  copy: (text: string) => Promise<boolean>;
}

export function useClipboard(timeout = 2000): UseClipboardResult {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (!navigator?.clipboard) {
        logger.warn('clipboard.unsupported');
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setIsCopied(false);
          timeoutRef.current = null;
        }, timeout);
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

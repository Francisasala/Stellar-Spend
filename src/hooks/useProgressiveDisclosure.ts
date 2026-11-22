import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'stellar-spend-advanced-options';

export interface UseProgressiveDisclosureResult {
  isOpen: boolean;
  toggle: () => void;
  isMounted: boolean;
}

function getStorageKey(key: string): string {
  return `${STORAGE_KEY}:${key}`;
}

function isStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function useProgressiveDisclosure(
  key: string,
  defaultOpen = false,
): UseProgressiveDisclosureResult {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);

    if (!isStorageAvailable()) {
      return;
    }

    try {
      const stored = window.localStorage.getItem(getStorageKey(key));
      if (stored !== null) {
        setIsOpen(stored === 'true');
      }
    } catch {
      // Ignore storage read errors (e.g. privacy mode) and keep default state.
    }
  }, [key]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const newValue = !prev;

      if (isStorageAvailable()) {
        try {
          window.localStorage.setItem(getStorageKey(key), String(newValue));
        } catch {
          // Ignore storage write errors and keep in-memory state.
        }
      }

      return newValue;
    });
  }, [key]);

  return {
    isOpen,
    toggle,
    isMounted,
  };
}

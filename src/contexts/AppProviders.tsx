'use client';

import { ReactNode } from 'react';
import { NotificationProvider } from './NotificationProvider';
import { ThemeProvider } from './ThemeContext';
import { I18nProvider } from '@/lib/i18n/provider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Composite provider wrapper for all app-level context providers.
 * Provider ordering is critical:
 * 1. I18nProvider - must be outermost (affects all descendants)
 * 2. ErrorBoundary - catches errors across all descendants
 * 3. ThemeProvider - sets up theme context
 * 4. NotificationProvider - unified toast + notification-center system (#1042)
 *
 * Changing this order can cause hydration mismatches or context errors.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <NotificationProvider>{children}</NotificationProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </I18nProvider>
  );
}

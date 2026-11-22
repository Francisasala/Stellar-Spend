'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ErrorFallback } from '@/components/error/ErrorFallback';
import { logger } from '@/lib/logger';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function HistoryError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
    logger.error('history.error', { digest: error.digest }, error);
  }, [error]);

  return (
    <ErrorFallback
      title="Transaction History Error"
      description="Unable to load transaction history at this time."
      error={error}
      actions={
        <>
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Link href="/">
            <Button variant="outline">Go home</Button>
          </Link>
        </>
      }
    />
  );
}

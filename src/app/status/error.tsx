'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { logger } from '@/lib/logger';
import { ErrorFallback } from '@/components/error-boundary/ErrorFallback';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StatusError({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
    logger.error('status.error', { digest: error.digest }, error);
  }, [error]);

  return (
    <ErrorFallback
      title="Status Error"
      description="Unable to load status information at this time."
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

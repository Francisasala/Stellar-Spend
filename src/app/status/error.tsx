'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { logger } from '@/lib/logger';

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Status Error</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Unable to load status information at this time.
          </p>
          {error.message && (
            <p className="mt-2 text-xs text-muted-foreground break-words">{error.message}</p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Link href="/">
            <Button variant="outline">Go home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

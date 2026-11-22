import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { unauthorized, serverError } from '@/lib/api-errors';
import { generateRequestId } from '@/lib/offramp';
import { createNonceTable } from '@/lib/webhookVerify';
import { withIdempotency } from '@/lib/idempotency';
import { logger } from '@/lib/logger';
import { createWebhookSystem } from '@/lib/webhook';
import type { NextRequest } from 'next/server';

const SENSITIVE_HEADERS = new Set(['authorization', 'x-paycrest-signature']);

function redactHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  });
  return result;
}

export const maxDuration = 10;

async function handleWebhook(request: NextRequest): Promise<NextResponse> {
  await createNonceTable().catch(() => {});

  const requestId = generateRequestId();
  const reqLogger = logger.withContext({ requestId });

  const rawBody = await request.text();
  const signature = request.headers.get('X-Paycrest-Signature') ?? '';
  const timestamp = request.headers.get('X-Paycrest-Timestamp');
  const nonce = request.headers.get('X-Paycrest-Nonce');

  if (!signature || !timestamp || !nonce) {
    reqLogger.warn('webhook.missing_headers', {
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
      hasNonce: !!nonce,
    });
    return unauthorized('Missing required security headers');
  }

  // Create webhook system
  const webhookSystem = createWebhookSystem({
    paycrest: {
      webhookSecret: env.server.PAYCREST_WEBHOOK_SECRET,
      timestampToleranceMs: 5 * 60 * 1000, // 5 minutes
      requireNonce: true,
    },
  });

  // Validate webhook using modular system
  const verification = await webhookSystem.validateWebhook('paycrest', rawBody, signature, {
    'x-paycrest-timestamp': timestamp,
    'x-paycrest-nonce': nonce,
    ...Object.fromEntries(request.headers.entries()),
  });

  if (!verification.valid) {
    reqLogger.warn('webhook.invalid_signature', {
      reason: verification.reason ?? 'Invalid signature',
    });
    return unauthorized(verification.reason ?? 'Invalid signature');
  }

  // Enqueue for async processing (using existing webhook dispatcher)
  const { enqueue } = await import('@/lib/webhook');
  enqueue(
    {
      headers: redactHeaders(request.headers),
      body: rawBody,
      source: 'paycrest',
    },
    '/api/webhooks/paycrest/process',
  ).catch((err) => {
    reqLogger.error('webhook.enqueue_failed', err);
  });

  try {
    // Process webhook using modular system
    const results = await webhookSystem.processWebhook('paycrest', rawBody, {
      'x-paycrest-timestamp': timestamp,
      'x-paycrest-nonce': nonce,
      ...Object.fromEntries(request.headers.entries()),
    });

    // Check processing results
    const successfulResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);

    if (failedResults.length > 0) {
      const errors = failedResults.map((r) => r.error).filter(Boolean);
      reqLogger.warn('webhook.partial_failure', {
        successful: successfulResults.length,
        failed: failedResults.length,
        errors,
      });
    }

    reqLogger.info('webhook.processed', {
      processed: successfulResults.length,
      failed: failedResults.length,
    });
    return NextResponse.json({
      received: true,
      processed: successfulResults.length,
      failed: failedResults.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    reqLogger.error('webhook.processing_error', error, { error: errorMessage });
    return serverError('Failed to process webhook');
  }
}

export async function POST(request: NextRequest) {
  return withIdempotency(request, () => handleWebhook(request));
}

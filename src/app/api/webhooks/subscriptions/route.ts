import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorHandler } from '@/lib/error-handler';
import { createSubscription, listSubscriptions } from '@/lib/webhook';
import { WebhookEvent } from '@/lib/webhook';
import {
  isSupportedSchemaVersion,
  SUPPORTED_SCHEMA_VERSIONS,
  type SchemaVersion,
} from '@/lib/webhook';
import { requireApiKeyAdmin } from '@/app/api/api-keys/_utils';
import { validateBody } from '@/lib/validation/validate-request';

const createSubscriptionSchema = z.object({
  endpointUrl: z.string().min(1),
  events: z.array(z.string()).min(1),
  signingSecret: z.string().optional(),
  rateLimitMaxPerMinute: z.number().positive().optional(),
  description: z.string().optional(),
  schemaVersion: z.union([z.string(), z.number()]).optional(),
});

const VALID_EVENTS: WebhookEvent[] = [
  'transaction.created',
  'transaction.completed',
  'transaction.failed',
  'payout.initiated',
  'payout.completed',
  'payout.failed',
  'bridge.initiated',
  'bridge.completed',
];

export async function GET(request: NextRequest) {
  const unauthorized = requireApiKeyAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const subscriptions = await listSubscriptions();
    const safe = subscriptions.map(({ signingSecret, ...rest }) => ({
      ...rest,
      signingSecret: signingSecret ? signingSecret.slice(0, 8) + '...' : null,
    }));
    return NextResponse.json({ data: safe });
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKeyAdmin(request);
  if (unauthorized) return unauthorized;

  const validation = await validateBody(request, createSubscriptionSchema);
  if (!validation.success) return validation.response;
  const body = validation.data;

  for (const event of body.events) {
    if (!VALID_EVENTS.includes(event as WebhookEvent)) {
      return ErrorHandler.validation(
        `Invalid event: "${event}". Valid: ${VALID_EVENTS.join(', ')}`,
      );
    }
  }

  let schemaVersion: SchemaVersion | undefined;
  if (body.schemaVersion !== undefined) {
    const requested = String(body.schemaVersion);
    if (!isSupportedSchemaVersion(requested)) {
      return ErrorHandler.validation(
        `Invalid schemaVersion: "${requested}". Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}`,
      );
    }
    schemaVersion = requested;
  }

  try {
    const subscription = await createSubscription({
      endpointUrl: body.endpointUrl,
      events: body.events as WebhookEvent[],
      signingSecret: typeof body.signingSecret === 'string' ? body.signingSecret : undefined,
      rateLimitMaxPerMinute:
        typeof body.rateLimitMaxPerMinute === 'number' ? body.rateLimitMaxPerMinute : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      schemaVersion,
    });

    const { signingSecret, ...safe } = subscription;
    return NextResponse.json({ data: { ...safe, signingSecret } }, { status: 201 });
  } catch (error) {
    return ErrorHandler.serverError(error);
  }
}

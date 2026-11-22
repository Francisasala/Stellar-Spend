import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { applyRateLimit } from '@/lib/rateLimiter';
import { generateRequestId, createRequestLogger } from '@/lib/offramp';
import { withIdempotency } from '@/lib/idempotency';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import { paycrestOrderRouteSchema, formatZodErrors } from '@/lib/validators';

export const maxDuration = 20;

import { PayoutOrderRequest } from '@/lib/offramp';

import { PaycrestAdapter, PaycrestHttpError } from '@/lib/offramp';
import { withRequestId } from '@/lib/http/request-id';

/**
 * POST /api/offramp/paycrest/order
 *
 * Creates a Paycrest payout order.
 *
 * Request body:
 * {
 *   amount: number (required, > 0)
 *   rate: number (required, > 0)
 *   token: string (required, e.g., 'USDC')
 *   network: string (required, e.g., 'stellar')
 *   reference: string (required)
 *   returnAddress: string (required)
 *   recipient: {
 *     institution: string (required)
 *     accountIdentifier: string (required)
 *     accountName: string (required)
 *     currency: string (required)
 *   }
 * }
 *
 * Response:
 * {
 *   data: {
 *     id: string
 *     receiveAddress: string
 *     ...
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  return withIdempotency(
    req,
    async () => {
      const requestId = generateRequestId();
      const logger = createRequestLogger(requestId, 'POST', '/api/offramp/paycrest/order');

      try {
        // Rate limiting is enforced by the shared middleware helper (registry: 'paycrest-order')
        const limited = await applyRateLimit(req, 'paycrest-order');
        if (limited) {
          logger.logError(429, 'Rate limit exceeded');
          return withRequestId(limited, requestId);
        }

        const rawBody = await req.json();

        const zodResult = paycrestOrderRouteSchema.safeParse(rawBody);
        if (!zodResult.success) {
          const errors = formatZodErrors(zodResult.error);
          logger.logError(400, 'Validation failed');
          return withRequestId(
            ErrorHandler.handle(
              new ApiError(ErrorType.VALIDATION, errors[0].message, 400, { errors }),
            ),
            requestId,
          );
        }

        const { amount, rate, token, network, reference, returnAddress, recipient } =
          zodResult.data;
        const normalizedAmount = Math.floor(amount * 1e6) / 1e6;
        const normalizedRate = Number(rate.toFixed(6));

        logger.debug('[paycrest/order] amount normalization', {
          normalized: { amount: normalizedAmount, rate: normalizedRate },
        });

        const paycrest = new PaycrestAdapter(env.server.PAYCREST_API_KEY);
        const order = await paycrest.createOrder({
          amount: normalizedAmount,
          rate: normalizedRate,
          token,
          network,
          reference,
          returnAddress,
          recipient,
        } as PayoutOrderRequest);

        const response = NextResponse.json({ data: order });
        response.headers.set('X-Request-Id', requestId);
        logger.logSuccess(200);
        return response;
      } catch (err: unknown) {
        logger.error('Error creating Paycrest order:', {}, err);

        if (err instanceof PaycrestHttpError) {
          logger.logError(err.status, err.message);
          return withRequestId(ErrorHandler.handle(err, err.status), requestId);
        }
      }
    },
    { required: true },
  );
}

import { logger } from '@/lib/logger';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { globalContainer } from '@/lib/di';
import { SERVICE_KEYS } from '@/lib/di';
import { withIdempotency } from '@/lib/idempotency';
import { ErrorHandler } from '@/lib/error-handler';
import { validateBody } from '@/lib/validation/validate-request';
import { amountSchema } from '@/lib/validators/schemas';

export const maxDuration = 20;

const createOrderSchema = z.object({
  quoteId: z.string().min(1),
  fiatAmount: amountSchema,
  fiatCurrency: z.string().min(1),
  destinationAmount: amountSchema,
  destinationToken: z.string().min(1),
  destinationAddress: z.string().min(1),
  provider: z.string().min(1),
  rate: z.number().positive(),
});

export async function POST(request: NextRequest) {
  return withIdempotency(
    request,
    async () => {
      try {
        const validation = await validateBody(request, createOrderSchema);
        if (!validation.success) return validation.response;
        const {
          quoteId,
          fiatAmount,
          fiatCurrency,
          destinationAmount,
          destinationToken,
          destinationAddress,
          provider,
          rate,
        } = validation.data;

        const svc = await globalContainer.resolve(SERVICE_KEYS.ONRAMP_SERVICE);
        const order = await svc.createOrder({
          quoteId,
          fiatAmount,
          fiatCurrency,
          destinationAmount,
          destinationToken,
          destinationAddress,
          provider,
          rate,
        });

        return NextResponse.json(order, { status: 201 });
      } catch (error) {
        logger.error('Onramp order error:', {}, error);
        return ErrorHandler.serverError(error);
      }
    },
    { required: true },
  );
}

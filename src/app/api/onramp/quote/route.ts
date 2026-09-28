import { logger } from '@/lib/logger';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { globalContainer } from '@/lib/di';
import { SERVICE_KEYS } from '@/lib/di';
import { isSupportedCurrency } from '@/lib/currencies';
import { getCachedQuote } from '@/lib/cache';
import { ErrorHandler } from '@/lib/error-handler';
import { validateBody } from '@/lib/validation/validate-request';
import { amountSchema } from '@/lib/validators/schemas';

export const maxDuration = 15;

const onrampQuoteSchema = z.object({
  fiatAmount: amountSchema,
  fiatCurrency: z.string().min(1),
  destinationToken: z.string().min(1),
  destinationAddress: z.string().min(1),
  provider: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const validation = await validateBody(request, onrampQuoteSchema);
    if (!validation.success) return validation.response;
    const { fiatAmount, fiatCurrency, destinationToken, destinationAddress, provider } =
      validation.data;

    if (!isSupportedCurrency(fiatCurrency)) {
      return ErrorHandler.validation(`Unsupported currency: ${fiatCurrency}`);
    }

    const quote = await getCachedQuote(fiatAmount, fiatCurrency, destinationToken, async () => {
      const svc = await globalContainer.resolve(SERVICE_KEYS.ONRAMP_SERVICE);
      return svc.getQuote({
        fiatAmount,
        fiatCurrency,
        destinationToken,
        destinationAddress,
        provider,
      });
    });

    return NextResponse.json(quote);
  } catch (error) {
    logger.error('Onramp quote error:', {}, error);
    return ErrorHandler.serverError(error);
  }
}

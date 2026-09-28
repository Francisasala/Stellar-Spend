import { logger } from '@/lib/logger';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { validateAmount } from '@/lib/offramp';
import { calculateBridgeAmount } from '@/lib/offramp';
import { aggregateQuotes, type QuoteProvider } from '@/lib/quote-aggregator';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import { validateBody } from '@/lib/validation/validate-request';

export const maxDuration = 20;

const STABLECOIN_FEE = '0.5';

const FEE_METHOD_MAP: Record<string, 'stablecoin' | 'native'> = {
  USDC: 'stablecoin',
  stablecoin: 'stablecoin',
  XLM: 'native',
  native: 'native',
};

const quoteAggregateSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  currency: z.string().min(1),
  feeMethod: z.string().min(1),
  providers: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const validation = await validateBody(request, quoteAggregateSchema);
    if (!validation.success) return validation.response;
    const { amount, currency, feeMethod, providers } = validation.data;

    if (!validateAmount(String(amount ?? ''))) {
      return ErrorHandler.validation('Invalid amount: must be a positive number');
    }

    const normalizedFee = FEE_METHOD_MAP[feeMethod];
    if (!normalizedFee) {
      return ErrorHandler.validation('feeMethod must be "USDC", "XLM", "stablecoin", or "native"');
    }

    const bridgeAmount =
      normalizedFee === 'stablecoin'
        ? calculateBridgeAmount(String(amount), 'stablecoin', STABLECOIN_FEE)
        : String(amount);

    // Get bridge receive amount (simplified - in production, call Allbridge SDK)
    const receiveAmount = bridgeAmount;

    // Aggregate quotes from multiple providers
    const providerList: QuoteProvider[] = providers || ['paycrest'];
    const aggregatedQuotes = await aggregateQuotes(receiveAmount, currency, providerList);

    if (!aggregatedQuotes.bestQuote) {
      return ErrorHandler.handle(
        new ApiError(ErrorType.EXTERNAL_SERVICE, 'No quotes available from any provider'),
      );
    }

    return NextResponse.json(aggregatedQuotes);
  } catch (error) {
    logger.error('Quote aggregation error:', {}, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Invalid') || message.includes('less than')) {
      return ErrorHandler.validation(message);
    }
    return ErrorHandler.handle(new ApiError(ErrorType.SERVER_ERROR, 'Failed to aggregate quotes'));
  }
}

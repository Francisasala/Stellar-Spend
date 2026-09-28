import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorHandler } from '@/lib/error-handler';
import {
  processRefund,
  processEligibleRefunds,
  isRefundEligible,
} from '@/lib/refund';
import { dal } from '@/lib/db';
import { withIdempotency } from '@/lib/idempotency';
import { validateBody } from '@/lib/validation/validate-request';
import type { NextRequest } from 'next/server';

export const maxDuration = 30;

const refundBodySchema = z
  .object({
    userAddress: z.string().min(1).optional(),
    transactionId: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    partial: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.userAddress || data.transactionId), {
    message: 'userAddress or transactionId is required',
  });

export async function POST(request: NextRequest) {
  return withIdempotency(
    request,
    async () => {
      try {
        const validation = await validateBody(request, refundBodySchema);
        if (!validation.success) return validation.response;
        const body = validation.data;

        if (body.userAddress && !body.transactionId) {
          const results = await processEligibleRefunds(body.userAddress);
          return NextResponse.json({ data: results });
        }

        const { transactionId, reason = 'manual', partial = false } = body;
        if (!transactionId || typeof transactionId !== 'string') {
          return ErrorHandler.validation('transactionId is required');
        }

        const result = await processRefund(transactionId, reason, partial);
        if (!result.success) {
          return ErrorHandler.validation(result.error ?? 'Refund failed');
        }
        return NextResponse.json({ data: result });
      } catch (err) {
        return ErrorHandler.handle(err);
      }
    },
    { required: true },
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transactionId');
    if (!transactionId) {
      return ErrorHandler.validation('transactionId query param is required');
    }
    const tx = await dal.getById(transactionId);
    if (!tx) {
      return ErrorHandler.notFound('Transaction');
    }
    return NextResponse.json({
      data: {
        transactionId,
        eligible: isRefundEligible(tx),
        status: tx.status,
        payoutStatus: tx.payoutStatus,
      },
    });
  } catch (err) {
    return ErrorHandler.handle(err);
  }
}

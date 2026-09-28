import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import {
  createBatch,
  addTransactionToBatch,
  getBatchStatus,
  getBatchProgress,
  cancelBatch,
  executeBatch,
  getBatchAnalytics,
} from '@/lib/services';
import { withIdempotency } from '@/lib/idempotency';
import { validateBody } from '@/lib/validation/validate-request';

const batchRequestSchema = z
  .object({
    action: z.enum(['cancel', 'execute']).optional(),
    batchId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    transactions: z.array(z.object({ amount: z.number().optional() }).passthrough()).optional(),
  })
  .refine(
    (data) => {
      if (data.action === 'cancel' || data.action === 'execute') return Boolean(data.batchId);
      if (!data.action) {
        return Boolean(data.userId) && Array.isArray(data.transactions) && data.transactions.length > 0;
      }
      return true;
    },
    { message: 'Invalid batch request: check required fields for the given action' },
  );

export async function POST(req: NextRequest) {
  return withIdempotency(
    req,
    async () => {
      try {
        const validation = await validateBody(req, batchRequestSchema);
        if (!validation.success) return validation.response;
        const body = validation.data;
        const { action } = body;

        if (action === 'cancel') {
          const { batchId } = body;
          if (!batchId) return ErrorHandler.validation('Missing batchId');
          const result = await cancelBatch(batchId);
          return NextResponse.json({ batchId, status: 'cancelled', result: result.rows[0] });
        }

        if (action === 'execute') {
          const { batchId } = body;
          if (!batchId) return ErrorHandler.validation('Missing batchId');
          const result = await executeBatch(batchId, async (_payload) => {
            return `tx_${Date.now()}`;
          });
          return NextResponse.json({ batchId, ...result });
        }

        const { userId, transactions } = body;
        if (!userId || !transactions || transactions.length === 0) {
          return ErrorHandler.validation('userId and transactions are required');
        }
        const totalAmount = transactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);
        const batch = await createBatch(userId, totalAmount);

        for (const tx of transactions ?? []) {
          await addTransactionToBatch(batch.id, tx);
        }

        return NextResponse.json({ batchId: batch.id, status: 'created' });
      } catch (_error) {
        return ErrorHandler.handle(
          new ApiError(ErrorType.SERVER_ERROR, 'Failed to process batch request'),
        );
      }
    },
    { required: true },
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const batchId = searchParams.get('batchId');
    const view = searchParams.get('view');
    const userId = searchParams.get('userId');

    if (view === 'analytics') {
      const analytics = await getBatchAnalytics(userId ?? undefined);
      return NextResponse.json(analytics);
    }

    if (!batchId) {
      return ErrorHandler.validation('Missing batchId');
    }

    if (view === 'progress') {
      const progress = await getBatchProgress(batchId);
      return NextResponse.json(progress);
    }

    const status = await getBatchStatus(batchId);
    return NextResponse.json(status);
  } catch (_error) {
    return ErrorHandler.handle(new ApiError(ErrorType.SERVER_ERROR, 'Failed to get batch status'));
  }
}

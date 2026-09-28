import { NextResponse } from 'next/server';
import { getTransactionQueue, getDeliveryRetryQueue } from '@/lib/priority-queue';
import { list } from '@/lib/webhook';
import { logger } from '@/lib/logger';
import { ErrorHandler } from '@/lib/error-handler';

export async function GET() {
  try {
    const txQueue = getTransactionQueue();
    const txMetrics = txQueue.getMetrics();
    const backpressure = txQueue.getBackpressureStatus();
    const retryQueue = getDeliveryRetryQueue();

    const dlqEntries = await list().catch(() => []);
    retryQueue.updateDlqDepth(dlqEntries.length);

    const retryMetrics = retryQueue.getMetrics();

    if (backpressure.overLimit) {
      logger.warn('queue.backpressure_limit_reached', { backpressure });
    }

    return NextResponse.json({
      ok: true,
      metrics: {
        transactions: txMetrics,
        deliveryRetry: retryMetrics,
      },
      backpressure,
    });
  } catch (err) {
    logger.error('metrics.fetch_failed', {}, err);
    return ErrorHandler.serverError(err);
  }
}

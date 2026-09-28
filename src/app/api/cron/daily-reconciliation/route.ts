/**
 * Daily reconciliation cron route.
 *
 * This route is deliberately thin: it authenticates the cron call and
 * delegates all reconciliation work to src/lib/reconciliation.ts so that
 * manual and scheduled runs share one implementation.
 *
 * Closes #1203
 */
import { NextRequest, NextResponse } from 'next/server';
import { runReconciliationJob } from '@/lib/reconciliation';
import { dal } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { ReconciliationRecord } from '@/lib/reconciliation';
import { ErrorHandler } from '@/lib/error-handler';
import { ApiError, ErrorType } from '@/lib/error-types';
import type { Transaction } from '@/lib/transaction-storage';

type ReconciliationTransaction = Transaction & { baseTxHash?: string };

async function fetchDailyRecords(): Promise<ReconciliationRecord[]> {
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;
  try {
    const transactions = await dal.getByUser('*').catch(() => []);
    return transactions
      .filter((tx: ReconciliationTransaction) => tx.timestamp >= yesterday)
      .map((tx: ReconciliationTransaction) => ({
        transactionId: tx.id,
        stellarTxHash: tx.stellarTxHash,
        baseTxHash: tx.baseTxHash,
        paycrestOrderId: tx.payoutOrderId,
        amount: tx.amount,
        currency: tx.currency,
        timestamp: new Date(tx.timestamp).toISOString(),
      }));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) {
      return ErrorHandler.unauthorized('Unauthorized');
    }

    logger.info('cron.daily-reconciliation.start', {});

    const records = await fetchDailyRecords();
    const entry = await runReconciliationJob(records);

    logger.info('cron.daily-reconciliation.complete', {
      runId: entry.id,
      totalTransactions: entry.report.totalTransactions,
      discrepancies: entry.report.discrepancies.length,
      alerts: entry.alerts.length,
    });

    return NextResponse.json({
      ok: true,
      runId: entry.id,
      runAt: entry.runAt,
      report: entry.report,
      alerts: entry.alerts,
    });
  } catch (err) {
    logger.error('cron.daily-reconciliation.failed', {}, err);
    return ErrorHandler.handle(
      new ApiError(ErrorType.SERVER_ERROR, 'Daily reconciliation failed')
    );
  }
}
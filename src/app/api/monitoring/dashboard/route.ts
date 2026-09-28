import { NextResponse } from 'next/server';
import { getDashboardMetrics, recordUptimeCheck } from '@/lib/monitoring';
import { getTransactionQueue } from '@/lib/priority-queue';
import { getTransactionAnalytics } from '@/lib/transaction-analytics';
import { getApiMetrics, getDbMetrics, getVitalsMetrics, getPerfAlerts } from '@/lib/performance';
import { withApiErrorHandling } from '@/lib/error-handler';
import { fetchMetricTimed } from '@/lib/monitoring-metrics';

export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(async () => {
  // Ping the health endpoint and record uptime
  const healthResult = await fetchMetricTimed(async () => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/api/health`,
      { signal: AbortSignal.timeout(5000) },
    );
    return res.ok;
  });
  recordUptimeCheck(healthResult.ok && Boolean(healthResult.value), healthResult.durationMs);

  const [monitoring, queueMetrics, transactionAnalytics] = await Promise.all([
    Promise.resolve(getDashboardMetrics()),
    Promise.resolve(getTransactionQueue().getMetrics()),
    getTransactionAnalytics(),
  ]);

  return NextResponse.json({
    ok: true,
    monitoring,
    queue: queueMetrics,
    transactions: transactionAnalytics,
    performance: {
      api: getApiMetrics(),
      db: getDbMetrics(),
      vitals: getVitalsMetrics(),
      alerts: getPerfAlerts(),
    },
  });
});

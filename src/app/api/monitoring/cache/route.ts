import { NextResponse } from 'next/server';
import { cache } from '@/lib/cache';
import { ErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { fetchMetricTimed, formatCacheMetrics, buildMetricsEnvelope } from '@/lib/monitoring-metrics';

/**
 * GET /api/monitoring/cache
 *
 * Expose cache hit/miss metrics for observability dashboard
 */
export async function GET() {
  try {
    const metrics = cache.getMetrics();
    const healthResult = await fetchMetricTimed(() => cache.healthCheck());
    const health = healthResult.ok && Boolean(healthResult.value);

    return NextResponse.json(buildMetricsEnvelope(health, formatCacheMetrics(metrics)));
  } catch (error) {
    logger.error('cache.metrics_failed', {}, error);
    return ErrorHandler.serverError(error);
  }
}

/**
 * POST /api/monitoring/cache
 *
 * Warm cache manually (admin operation)
 */
export async function POST() {
  try {
    const { warmAllCaches } = await import('@/lib/cache/warming');
    await warmAllCaches();

    return NextResponse.json({
      success: true,
      message: 'Cache warming initiated',
    });
  } catch (error) {
    logger.error('cache.warming_failed', {}, error);
    return ErrorHandler.serverError(error);
  }
}

/**
 * DELETE /api/monitoring/cache
 *
 * Clear cache (admin operation)
 */
export async function DELETE() {
  try {
    await cache.clear();
    cache.resetMetrics();

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error) {
    logger.error('cache.clear_failed', {}, error);
    return ErrorHandler.serverError(error);
  }
}

import { NextResponse } from 'next/server';
import { performHealthCheck } from '@/lib/health-check';
import { checkDatabaseHealth } from '@/lib/health-check';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ready
 *
 * Readiness probe — answers "is this process ready to serve traffic?"
 * Alias for /api/health/readiness to match k8s probe conventions.
 *
 * HTTP 200 → ready (all critical deps healthy)
 * HTTP 503 → not ready (one or more critical deps down/degraded)
 */
export async function GET() {
  const [healthResult, dbResult] = await Promise.all([
    performHealthCheck(),
    checkDatabaseHealth(),
  ]);

  const isReady =
    dbResult.status !== 'unhealthy' &&
    healthResult.dependencies.stellar.status !== 'unhealthy';

  const status = isReady ? 200 : 503;

  return NextResponse.json(
    {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbResult,
        stellar: healthResult.dependencies.stellar,
        paycrest: healthResult.dependencies.paycrest,
        allbridge: healthResult.dependencies.allbridge,
      },
    },
    { status },
  );
}

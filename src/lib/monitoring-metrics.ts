/**
 * Shared metric-fetch/format helpers for the monitoring API routes
 * (monitoring/cache, monitoring/dashboard, monitoring/vitals).
 *
 * These routes each need to: run a timed async fetch, normalize the
 * result into a consistent envelope, and format numeric metrics the
 * same way. Centralizing that here removes the near-duplicate logic
 * that had drifted across the three route handlers.
 */

export interface TimedResult<T> {
  ok: boolean;
  durationMs: number;
  value?: T;
  error?: string;
}

/**
 * Run an async metric-fetching function, capturing elapsed time and
 * normalizing failures instead of letting the route handler catch/format
 * them individually.
 */
export async function fetchMetricTimed<T>(fn: () => Promise<T> | T): Promise<TimedResult<T>> {
  const start = Date.now();
  try {
    const value = await fn();
    return { ok: true, durationMs: Date.now() - start, value };
  } catch (error) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Round a rate (0..1) to a fixed number of decimal places for display. */
export function formatRate(rate: number, decimals = 4): number {
  if (!Number.isFinite(rate)) return 0;
  const factor = 10 ** decimals;
  return Math.round(rate * factor) / factor;
}

/** Format a count of raw metric samples into a stable, non-negative integer. */
export function formatCount(value: number | undefined | null): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export interface CacheMetricsShape {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
  hitRate: number;
}

/** Normalize a raw cache metrics object into the shape monitoring routes expose. */
export function formatCacheMetrics(metrics: Partial<CacheMetricsShape>): CacheMetricsShape {
  return {
    hits: formatCount(metrics.hits),
    misses: formatCount(metrics.misses),
    sets: formatCount(metrics.sets),
    errors: formatCount(metrics.errors),
    hitRate: formatRate(metrics.hitRate ?? 0),
  };
}

/** Standard envelope timestamp used across all monitoring endpoints. */
export function metricsTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Build the standard monitoring JSON envelope: a status string derived
 * from a health boolean, the formatted metrics payload, and a timestamp.
 */
export function buildMetricsEnvelope<T extends Record<string, unknown>>(
  healthy: boolean,
  metrics: T,
): { status: 'healthy' | 'degraded'; metrics: T; timestamp: string } {
  return {
    status: healthy ? 'healthy' : 'degraded',
    metrics,
    timestamp: metricsTimestamp(),
  };
}

/** Safely coerce an unknown vitals rating into one of the known buckets. */
export function normalizeVitalRating(rating: unknown): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
  if (rating === 'good' || rating === 'needs-improvement' || rating === 'poor') return rating;
  return 'unknown';
}

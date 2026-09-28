/**
 * Resolver usage tracking.
 *
 * Wraps a GraphQL resolver map (Query/Mutation/Subscription) so every
 * invocation is counted and timestamped. This gives us a real signal for
 * which resolvers/fields clients actually exercise, instead of guessing —
 * so unused ones can be safely removed once the counts confirm they're
 * dead, rather than deleting anything based on a static code read.
 */

export interface ResolverUsageRecord {
  operationType: 'Query' | 'Mutation' | 'Subscription';
  fieldName: string;
  callCount: number;
  lastCalledAt: number | null;
}

type ResolverFn = (...args: unknown[]) => unknown;
type ResolverMap = Record<string, ResolverFn>;

const usage = new Map<string, ResolverUsageRecord>();

function key(operationType: string, fieldName: string): string {
  return `${operationType}.${fieldName}`;
}

function recordCall(operationType: 'Query' | 'Mutation' | 'Subscription', fieldName: string): void {
  const k = key(operationType, fieldName);
  const existing = usage.get(k);
  if (existing) {
    existing.callCount += 1;
    existing.lastCalledAt = Date.now();
  } else {
    usage.set(k, { operationType, fieldName, callCount: 1, lastCalledAt: Date.now() });
  }
}

/**
 * Wraps every resolver in `map` with a usage-tracking shim. Also
 * pre-registers every field name at zero calls so fields that are NEVER
 * invoked still show up in the report (that's the actual "unused" signal).
 */
export function withUsageTracking<T extends ResolverMap>(
  operationType: 'Query' | 'Mutation' | 'Subscription',
  map: T,
): T {
  const wrapped = {} as T;
  for (const fieldName of Object.keys(map)) {
    const k = key(operationType, fieldName);
    if (!usage.has(k)) {
      usage.set(k, { operationType, fieldName, callCount: 0, lastCalledAt: null });
    }
    const original = map[fieldName];
    (wrapped as ResolverMap)[fieldName] = (...args: unknown[]) => {
      recordCall(operationType, fieldName);
      return original(...args);
    };
  }
  return wrapped;
}

/** Returns the full usage report, most-called first. */
export function getResolverUsageReport(): ResolverUsageRecord[] {
  return [...usage.values()].sort((a, b) => b.callCount - a.callCount);
}

/** Returns resolvers that have never been called — candidates for removal. */
export function getUnusedResolvers(): ResolverUsageRecord[] {
  return getResolverUsageReport().filter((r) => r.callCount === 0);
}

/** Resets counters. Intended for tests only. */
export function resetResolverUsage(): void {
  usage.clear();
}

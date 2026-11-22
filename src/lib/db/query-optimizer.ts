import { logger } from '../logger';

export interface QueryMetrics {
  query: string;
  executionTime: number;
  rowsAffected: number;
  timestamp: number;
  isSlowQuery: boolean;
}

export interface QueryAnalysis {
  totalQueries: number;
  averageExecutionTime: number;
  slowQueries: QueryMetrics[];
  topQueries: Array<{ query: string; count: number; avgTime: number }>;
  recommendations: string[];
}

export class QueryOptimizer {
  private queryMetrics: QueryMetrics[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly MAX_METRICS = 10000;

  /**
   * Record query metrics
   */
  recordQuery(query: string, executionTime: number, rowsAffected = 0): void {
    const metric: QueryMetrics = {
      query: this.normalizeQuery(query),
      executionTime,
      rowsAffected,
      timestamp: Date.now(),
      isSlowQuery: executionTime > this.SLOW_QUERY_THRESHOLD,
    };

    this.queryMetrics.push(metric);

    // Keep metrics bounded
    if (this.queryMetrics.length > this.MAX_METRICS) {
      this.queryMetrics = this.queryMetrics.slice(-this.MAX_METRICS);
    }

    if (metric.isSlowQuery) {
      logger.warn('Slow query detected', {
        query: metric.query,
        executionTime,
        threshold: this.SLOW_QUERY_THRESHOLD,
      });
    }
  }

  /**
   * Normalize query for grouping
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '$N')
      .replace(/'[^']*'/g, "'...'")
      .trim();
  }

  /**
   * Analyze query patterns and performance
   */
  analyzeQueries(): QueryAnalysis {
    const slowQueries = this.queryMetrics.filter((m) => m.isSlowQuery);
    const avgExecutionTime =
      this.queryMetrics.length > 0
        ? this.queryMetrics.reduce((sum, m) => sum + m.executionTime, 0) / this.queryMetrics.length
        : 0;

    // Group queries by normalized form
    const queryGroups = new Map<string, { count: number; totalTime: number; times: number[] }>();
    for (const metric of this.queryMetrics) {
      const group = queryGroups.get(metric.query) || {
        count: 0,
        totalTime: 0,
        times: [],
      };
      group.count++;
      group.totalTime += metric.executionTime;
      group.times.push(metric.executionTime);
      queryGroups.set(metric.query, group);
    }

    const topQueries = Array.from(queryGroups.entries())
      .map(([query, group]) => ({
        query,
        count: group.count,
        avgTime: group.totalTime / group.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    const recommendations = this.generateRecommendations(topQueries, slowQueries);

    return {
      totalQueries: this.queryMetrics.length,
      averageExecutionTime: avgExecutionTime,
      slowQueries: slowQueries.slice(-100),
      topQueries,
      recommendations,
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    topQueries: Array<{ query: string; count: number; avgTime: number }>,
    slowQueries: QueryMetrics[],
  ): string[] {
    const recommendations: string[] = [];

    // Check for N+1 patterns
    const selectCounts = new Map<string, number>();
    for (const metric of this.queryMetrics) {
      if (metric.query.toUpperCase().startsWith('SELECT')) {
        const count = selectCounts.get(metric.query) || 0;
        selectCounts.set(metric.query, count + 1);
      }
    }

    for (const [query, count] of selectCounts.entries()) {
      if (count > 100 && query.length < 100) {
        recommendations.push(
          `Potential N+1 query detected: "${query}" executed ${count} times. Consider using JOIN or batch queries.`,
        );
      }
    }

    // Check for slow queries without indexes
    for (const slow of slowQueries.slice(0, 5)) {
      if (slow.query.includes('WHERE') && !slow.query.includes('INDEX')) {
        recommendations.push(
          `Slow query detected: "${slow.query}". Consider adding an index on the WHERE clause columns.`,
        );
      }
    }

    // Check for missing LIMIT clauses
    for (const query of topQueries) {
      if (
        query.query.toUpperCase().includes('SELECT') &&
        !query.query.toUpperCase().includes('LIMIT') &&
        query.count > 50
      ) {
        recommendations.push(
          `Query "${query.query}" executed ${query.count} times without LIMIT. Consider adding pagination.`,
        );
      }
    }

    return recommendations;
  }

  /**
   * Get slow queries
   */
  getSlowQueries(limit = 50): QueryMetrics[] {
    return this.queryMetrics
      .filter((m) => m.isSlowQuery)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.queryMetrics = [];
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const analysis = this.analyzeQueries();
    return {
      totalQueries: analysis.totalQueries,
      averageExecutionTime: Math.round(analysis.averageExecutionTime),
      slowQueryCount: analysis.slowQueries.length,
      topQueries: analysis.topQueries.slice(0, 5),
    };
  }
}

export const queryOptimizer = new QueryOptimizer();

export interface IndexCandidate {
  query: string;
  whereColumns: string[];
  avgExecutionTime: number;
  count: number;
  maxExecutionTime: number;
}

/**
 * Extract column names referenced in a WHERE clause of a normalized query.
 * Best-effort parsing intended to help justify index creation.
 */
export function extractWhereColumns(query: string): string[] {
  const whereMatch = query.match(
    /\bWHERE\b([\s\S]*?)(?:\bGROUP\b|\bORDER\b|\bLIMIT\b|\bRETURNING\b|$)/i,
  );
  if (!whereMatch) {
    return [];
  }

  const whereClause = whereMatch[1];
  const columns = new Set<string>();

  // Match simple column references like "col", "table.col", "col = $N", "col IN (...)"
  const columnPattern =
    /\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)\b(?=\s*(?:=|<|>|<=|>=|<>|!=|\bLIKE\b|\bIN\b|\bIS\b|\bBETWEEN\b))/gi;
  let match: RegExpExecArray | null;
  while ((match = columnPattern.exec(whereClause)) !== null) {
    const candidate = match[1];
    const upper = candidate.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT' || upper === 'NULL') {
      continue;
    }
    columns.add(candidate);
  }

  return Array.from(columns);
}

/**
 * Build a report of slow queries suitable for justifying index creation.
 * Returns normalized queries with their WHERE columns and average execution time,
 * sorted by average execution time descending.
 */
export function getIndexCandidates(limit = 20): IndexCandidate[] {
  const slowQueries = queryOptimizer.getSlowQueries(1000);
  const groups = new Map<
    string,
    { totalTime: number; count: number; maxTime: number; whereColumns: string[] }
  >();

  for (const metric of slowQueries) {
    const whereColumns = extractWhereColumns(metric.query);
    if (whereColumns.length === 0) {
      continue;
    }
    const group = groups.get(metric.query) || {
      totalTime: 0,
      count: 0,
      maxTime: 0,
      whereColumns,
    };
    group.totalTime += metric.executionTime;
    group.count++;
    group.maxTime = Math.max(group.maxTime, metric.executionTime);
    groups.set(metric.query, group);
  }

  return Array.from(groups.entries())
    .map(([query, group]) => ({
      query,
      whereColumns: group.whereColumns,
      avgExecutionTime: group.totalTime / group.count,
      count: group.count,
      maxExecutionTime: group.maxTime,
    }))
    .sort((a, b) => b.avgExecutionTime - a.avgExecutionTime)
    .slice(0, limit);
}

/**
 * Middleware to record query metrics
 */
export async function recordQueryMetrics(
  query: string,
  params: unknown[],
  executor: () => Promise<unknown>,
): Promise<unknown> {
  const start = Date.now();
  try {
    const result = await executor();
    const executionTime = Date.now() - start;
    queryOptimizer.recordQuery(query, executionTime);
    return result;
  } catch (error) {
    const executionTime = Date.now() - start;
    queryOptimizer.recordQuery(query, executionTime);
    throw error;
  }
}

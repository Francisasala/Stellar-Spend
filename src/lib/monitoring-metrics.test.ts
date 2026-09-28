import { describe, it, expect } from 'vitest';
import {
  fetchMetricTimed,
  formatRate,
  formatCount,
  formatCacheMetrics,
  buildMetricsEnvelope,
  normalizeVitalRating,
  metricsTimestamp,
} from './monitoring-metrics';

describe('monitoring-metrics helpers', () => {
  describe('fetchMetricTimed', () => {
    it('returns ok:true with the resolved value and a duration', async () => {
      const result = await fetchMetricTimed(async () => 42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('captures thrown errors instead of rejecting', async () => {
      const result = await fetchMetricTimed(async () => {
        throw new Error('boom');
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('boom');
    });

    it('supports synchronous producer functions', async () => {
      const result = await fetchMetricTimed(() => 'sync-value');
      expect(result.ok).toBe(true);
      expect(result.value).toBe('sync-value');
    });
  });

  describe('formatRate', () => {
    it('rounds to the requested decimal places', () => {
      expect(formatRate(0.123456, 2)).toBe(0.12);
    });

    it('defaults to 4 decimal places', () => {
      expect(formatRate(1 / 3)).toBe(0.3333);
    });

    it('returns 0 for non-finite input', () => {
      expect(formatRate(NaN)).toBe(0);
      expect(formatRate(Infinity)).toBe(0);
    });
  });

  describe('formatCount', () => {
    it('truncates and clamps to non-negative integers', () => {
      expect(formatCount(3.9)).toBe(3);
      expect(formatCount(-5)).toBe(0);
    });

    it('handles null/undefined/non-finite as 0', () => {
      expect(formatCount(undefined)).toBe(0);
      expect(formatCount(null)).toBe(0);
      expect(formatCount(NaN)).toBe(0);
    });
  });

  describe('formatCacheMetrics', () => {
    it('fills in missing fields with safe defaults', () => {
      expect(formatCacheMetrics({})).toEqual({
        hits: 0,
        misses: 0,
        sets: 0,
        errors: 0,
        hitRate: 0,
      });
    });

    it('formats a fully populated metrics object', () => {
      expect(
        formatCacheMetrics({ hits: 10, misses: 2, sets: 5, errors: 1, hitRate: 0.83333 }),
      ).toEqual({
        hits: 10,
        misses: 2,
        sets: 5,
        errors: 1,
        hitRate: 0.8333,
      });
    });
  });

  describe('buildMetricsEnvelope', () => {
    it('marks healthy status when the health flag is true', () => {
      const envelope = buildMetricsEnvelope(true, { foo: 1 });
      expect(envelope.status).toBe('healthy');
      expect(envelope.metrics).toEqual({ foo: 1 });
      expect(typeof envelope.timestamp).toBe('string');
    });

    it('marks degraded status when the health flag is false', () => {
      const envelope = buildMetricsEnvelope(false, { foo: 1 });
      expect(envelope.status).toBe('degraded');
    });
  });

  describe('normalizeVitalRating', () => {
    it('passes through known ratings', () => {
      expect(normalizeVitalRating('good')).toBe('good');
      expect(normalizeVitalRating('needs-improvement')).toBe('needs-improvement');
      expect(normalizeVitalRating('poor')).toBe('poor');
    });

    it('falls back to unknown for anything else', () => {
      expect(normalizeVitalRating('bogus')).toBe('unknown');
      expect(normalizeVitalRating(undefined)).toBe('unknown');
    });
  });

  describe('metricsTimestamp', () => {
    it('produces an ISO-8601 string', () => {
      expect(() => new Date(metricsTimestamp()).toISOString()).not.toThrow();
    });
  });
});

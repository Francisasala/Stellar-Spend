import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  TransactionAnalytics,
  CurrencyBreakdown,
  FeeAnalysis,
  SpendingPattern,
  AnalyticsPeriod,
  AnalyticsReport,
} from './analytics';

describe('Analytics types', () => {
  it('TransactionAnalytics has all required fields', () => {
    const analytics: TransactionAnalytics = {
      totalTransactions: 100,
      totalVolume: '1598000',
      averageAmount: '15980',
      successRate: 0.95,
      failureRate: 0.05,
      pendingCount: 3,
    };
    expect(analytics.totalTransactions).toBe(100);
    expect(analytics.successRate).toBe(0.95);
  });

  it('CurrencyBreakdown has all required fields', () => {
    const breakdown: CurrencyBreakdown = {
      currency: 'NGN',
      count: 60,
      volume: '958800',
      percentage: 60,
    };
    expect(breakdown.currency).toBe('NGN');
    expect(breakdown.percentage).toBe(60);
  });

  it('FeeAnalysis has all required fields', () => {
    const fees: FeeAnalysis = {
      totalFeesPaid: '15980',
      averageFeePercentage: 1.0,
      bridgeFees: '7990',
      payoutFees: '7990',
    };
    expect(fees.totalFeesPaid).toBe('15980');
  });

  it('SpendingPattern has all required fields', () => {
    const pattern: SpendingPattern = {
      date: '2025-01-15',
      amount: '500.00',
      transactionCount: 5,
      currency: 'NGN',
    };
    expect(pattern.date).toBe('2025-01-15');
  });

  it('AnalyticsPeriod has all required fields', () => {
    const period: AnalyticsPeriod = {
      startDate: Date.now() - 86400000,
      endDate: Date.now(),
      analytics: {
        totalTransactions: 10,
        totalVolume: '15980',
        averageAmount: '1598',
        successRate: 0.9,
        failureRate: 0.1,
        pendingCount: 1,
      },
      currencyBreakdown: [
        {
          currency: 'NGN',
          count: 10,
          volume: '15980',
          percentage: 100,
        },
      ],
      feeAnalysis: {
        totalFeesPaid: '159.80',
        averageFeePercentage: 1.0,
        bridgeFees: '79.90',
        payoutFees: '79.90',
      },
      spendingPatterns: [
        {
          date: '2025-01-15',
          amount: '1598',
          transactionCount: 10,
          currency: 'NGN',
        },
      ],
    };
    expect(period.currencyBreakdown).toHaveLength(1);
    expectTypeOf(period.funnel).toMatchTypeOf<any>();
  });

  it('AnalyticsReport has all required fields', () => {
    const report: AnalyticsReport = {
      period: {
        startDate: 0,
        endDate: 1,
        analytics: {
          totalTransactions: 0,
          totalVolume: '0',
          averageAmount: '0',
          successRate: 0,
          failureRate: 0,
          pendingCount: 0,
        },
        currencyBreakdown: [],
        feeAnalysis: {
          totalFeesPaid: '0',
          averageFeePercentage: 0,
          bridgeFees: '0',
          payoutFees: '0',
        },
        spendingPatterns: [],
      },
      generatedAt: Date.now(),
      userAddress: 'GBXXXX',
    };
    expect(report.generatedAt).toBeGreaterThan(0);
    expect(report.userAddress).toBe('GBXXXX');
  });
});

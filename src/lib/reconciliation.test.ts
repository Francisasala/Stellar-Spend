import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reconcileTransaction,
  generateReconciliationReport,
  buildSettlementCsv,
  buildDailySettlementReport,
  generateAlerts,
  runReconciliationJob,
  aggregateRecordsByDay,
  performManualReconciliation,
} from './reconciliation';
import type { ReconciliationRecord, ReconciliationDiscrepancy } from './reconciliation';

vi.mock('@/lib/db/client', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    withContext: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/lib/env', () => ({
  env: {
    server: {
      STELLAR_HORIZON_URL: 'https://horizon.test',
      BASE_RPC_URL: 'https://base-rpc.test',
      PAYCREST_API_KEY: 'test-key',
    },
  },
}));

function makeRecord(overrides: Partial<ReconciliationRecord> = {}): ReconciliationRecord {
  return {
    transactionId: `tx-${Date.now()}`,
    stellarTxHash: 'stellar-hash-abc',
    baseTxHash: '0xbasehash123',
    paycrestOrderId: 'order-789',
    amount: '100.00',
    currency: 'USDC',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('reconcileTransaction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects missing Stellar transaction', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const record = makeRecord();
    const results = await reconcileTransaction(record);
    expect(results.some((r) => r.type === 'missing_stellar')).toBe(true);
    expect(results.some((r) => r.type === 'missing_base')).toBe(true);
    expect(results.some((r) => r.type === 'missing_paycrest')).toBe(true);
  });

  it('detects amount mismatch when Stellar and Paycrest disagree', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xabc' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '200.00' } }),
      });

    const record = makeRecord({ amount: '100.00' });
    const results = await reconcileTransaction(record);
    expect(results.some((r) => r.type === 'amount_mismatch')).toBe(true);
  });

  it('detects status mismatch between Stellar and Paycrest', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xabc' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '100.00' } }),
      });

    const record = makeRecord({ amount: '100.00' });
    const results = await reconcileTransaction(record);
    expect(results.some((r) => r.type === 'status_mismatch')).toBe(true);
  });

  it('detects unsettled Paycrest order', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xabc' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'pending', amount: '100.00' } }),
      });

    const record = makeRecord({ amount: '100.00' });
    const results = await reconcileTransaction(record);
    expect(results.some((r) => r.type === 'unsettled_order')).toBe(true);
  });

  it('returns empty discrepancies for well-matched records', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xabc' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '100.00' } }),
      });

    const record = makeRecord({ amount: '100.00' });
    const results = await reconcileTransaction(record);
    expect(results.length).toBe(0);
  });
});

describe('generateReconciliationReport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a report with correct summary', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const records = [
      makeRecord({
        transactionId: 'tx-1',
        stellarTxHash: 'hash-1',
        baseTxHash: '0xbase1',
        paycrestOrderId: 'order-1',
      }),
      makeRecord({
        transactionId: 'tx-2',
        stellarTxHash: 'hash-2',
        baseTxHash: '0xbase2',
        paycrestOrderId: 'order-2',
      }),
    ];

    const report = await generateReconciliationReport(records);
    expect(report.totalTransactions).toBe(2);
    expect(report.summary.missingStellar).toBeGreaterThan(0);
    expect(report.summary.missingBase).toBeGreaterThan(0);
    expect(report.summary.missingPaycrest).toBeGreaterThan(0);
    expect(report.date).toBeDefined();
  });

  it('handles empty records', async () => {
    const report = await generateReconciliationReport([]);
    expect(report.totalTransactions).toBe(0);
    expect(report.matchedTransactions).toBe(0);
    expect(report.discrepancies.length).toBe(0);
  });
});

describe('buildSettlementCsv', () => {
  it('generates CSV with header and rows', () => {
    const discrepancies: ReconciliationDiscrepancy[] = [
      {
        transactionId: 'tx-1',
        type: 'missing_stellar',
        description: 'Stellar tx not found',
        severity: 'high',
      },
    ];

    const report = {
      timestamp: new Date().toISOString(),
      date: '2026-06-26',
      totalTransactions: 1,
      matchedTransactions: 0,
      discrepancies,
      summary: {
        missingStellar: 1,
        missingBase: 0,
        missingPaycrest: 0,
        amountMismatches: 0,
        statusMismatches: 0,
        unsettledOrders: 0,
      },
    };

    const csv = buildSettlementCsv(report);
    expect(csv).toContain('Transaction ID');
    expect(csv).toContain('tx-1');
    expect(csv).toContain('missing_stellar');
  });
});

describe('buildDailySettlementReport', () => {
  it('builds a daily settlement report with volumes', async () => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const records = [
      makeRecord({ transactionId: 'tx-daily-1', amount: '100' }),
      makeRecord({ transactionId: 'tx-daily-2', amount: '200' }),
    ];

    const daily = await buildDailySettlementReport(records);
    expect(daily.date).toBeDefined();
    expect(daily.totalCount).toBe(2);
    expect(daily.stellarVolume).toBeDefined();
    expect(daily.paycrestVolume).toBeDefined();
    expect(daily.unsettledOrders).toBeDefined();
  });
});

describe('generateAlerts', () => {
  it('generates high severity alert for missing stellar transactions', () => {
    const discrepancies: ReconciliationDiscrepancy[] = Array.from({ length: 10 }, (_, i) => ({
      transactionId: `tx-${i}`,
      type: 'missing_stellar' as const,
      description: 'Missing',
      severity: 'high' as const,
    }));

    const report = {
      timestamp: new Date().toISOString(),
      date: '2026-06-26',
      totalTransactions: 10,
      matchedTransactions: 0,
      discrepancies,
      summary: {
        missingStellar: 10,
        missingBase: 0,
        missingPaycrest: 0,
        amountMismatches: 0,
        statusMismatches: 0,
        unsettledOrders: 0,
      },
    };

    const alerts = generateAlerts(report);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((a) => a.severity === 'high')).toBe(true);
  });

  it('generates alert for unsettled orders over threshold', () => {
    const discrepancies: ReconciliationDiscrepancy[] = Array.from({ length: 5 }, (_, i) => ({
      transactionId: `tx-${i}`,
      type: 'unsettled_order' as const,
      description: 'Unsettled',
      severity: 'medium' as const,
    }));

    const report = {
      timestamp: new Date().toISOString(),
      date: '2026-06-26',
      totalTransactions: 5,
      matchedTransactions: 0,
      discrepancies,
      summary: {
        missingStellar: 0,
        missingBase: 0,
        missingPaycrest: 0,
        amountMismatches: 0,
        statusMismatches: 0,
        unsettledOrders: 5,
      },
    };

    const alerts = generateAlerts(report);
    expect(alerts.some((a) => a.message.includes('unsettled'))).toBe(true);
  });
});

describe('runReconciliationJob', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
  });

  it('produces a history entry', async () => {
    const records = [makeRecord({ transactionId: 'tx-job-1' })];
    const entry = await runReconciliationJob(records);
    expect(entry.id).toContain('recon_');
    expect(entry.report).toBeDefined();
    expect(entry.alerts).toBeDefined();
  });
});

describe('aggregateRecordsByDay', () => {
  it('groups records by day', async () => {
    const records = [
      makeRecord({ transactionId: 'tx-day-1', timestamp: '2026-06-26T10:00:00Z' }),
      makeRecord({ transactionId: 'tx-day-2', timestamp: '2026-06-26T12:00:00Z' }),
      makeRecord({ transactionId: 'tx-day-3', timestamp: '2026-06-25T08:00:00Z' }),
    ];

    const byDay = await aggregateRecordsByDay([], [], [], records);
    expect(byDay['2026-06-26']).toHaveLength(2);
    expect(byDay['2026-06-25']).toHaveLength(1);
  });
});

describe('performManualReconciliation', () => {
  it('records retry action', async () => {
    const result = await performManualReconciliation({
      transactionId: 'tx-manual-1',
      action: 'retry',
      notes: 'Manual retry requested',
      resolvedBy: 'admin',
    });
    expect(result.success).toBe(true);
  });

  it('records investigate action', async () => {
    const result = await performManualReconciliation({
      transactionId: 'tx-manual-2',
      action: 'investigate',
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain('investigate');
  });
});

/* -------------------------------------------------------------------------
 * Route delegation tests (#1203)
 * Ensures the cron route uses runReconciliation and forwards params.
 * ----------------------------------------------------------------------- */

describe('daily-reconciliation cron route (#1203)', () => {
  it('is a thin wrapper that imports runReconciliation', async () => {
    const routePath = require.resolve('../../app/api/cron/daily-reconciliation/route.ts');
    const src = require('fs').readFileSync(routePath, 'utf8');
    expect(src).toMatch(
      /import\s+\{[^}]*runReconciliation[^}]*\}\s+from\s+['"]@\/lib\/reconciliation['"]/,
    );
  });

  it('runReconciliation defaults windowEnd to now and windowStart to 24h earlier', async () => {
    const mod = await import('../reconciliation');
    const result = await mod.runReconciliation({ dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(typeof result.windowStart).toBe('string');
    expect(typeof result.windowEnd).toBe('string');
    const start = new Date(result.windowStart).getTime();
    const end = new Date(result.windowEnd).getTime();
    expect(end).toBeGreaterThanOrEqual(start);
  });

  it('runReconciliation honours explicit windowStart / windowEnd', async () => {
    const mod = await import('../reconciliation');
    const start = '2025-01-01T00:00:00.000Z';
    const end = '2025-01-02T00:00:00.000Z';
    const result = await mod.runReconciliation({ windowStart: start, windowEnd: end });
    expect(result.windowStart).toBe(start);
    expect(result.windowEnd).toBe(end);
  });
});

/* =========================================================================
 * Edge case tests — issue #1350
 * "reconciliation.ts has a test file but misses mismatched-amount and
 *  missing-ledger cases. Add them."
 * ========================================================================= */

describe('#1350 — mismatched-amount edge cases', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects amount mismatch when Paycrest returns a string amount different from record', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xabc' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '99.99' } }),
      });

    const record = makeRecord({ amount: '100.00' });
    const results = await reconcileTransaction(record);
    const mismatch = results.find((r) => r.type === 'amount_mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch?.severity).toBe('high');
    expect(mismatch?.description).toContain('100.00');
    expect(mismatch?.description).toContain('99.99');
  });

  it('detects amount mismatch when Paycrest uses senderAmount field instead of amount', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xabc' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', senderAmount: '50.00' } }),
      });

    // record.amount is '100.00', senderAmount is '50.00' — mismatch
    const record = makeRecord({ amount: '100.00' });
    const results = await reconcileTransaction(record);
    const mismatch = results.find((r) => r.type === 'amount_mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch?.description).toContain('50.00');
  });

  it('does NOT flag amount mismatch when amounts match exactly', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xabc' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '100.00' } }),
      });

    const record = makeRecord({ amount: '100.00' });
    const results = await reconcileTransaction(record);
    expect(results.find((r) => r.type === 'amount_mismatch')).toBeUndefined();
  });

  it('does NOT flag amount mismatch when record has no amount field', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xabc' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '999.00' } }),
      });

    // amount is intentionally absent — reconciliation cannot compare
    const record = makeRecord({ amount: undefined });
    const results = await reconcileTransaction(record);
    expect(results.find((r) => r.type === 'amount_mismatch')).toBeUndefined();
  });

  it('amount mismatch discrepancy contains both stellarData and paycrestData', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xabc' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '1.00' } }),
      });

    const record = makeRecord({ amount: '200.00' });
    const results = await reconcileTransaction(record);
    const mismatch = results.find((r) => r.type === 'amount_mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch?.stellarData).toBeDefined();
    expect(mismatch?.paycrestData).toBeDefined();
  });

  it('report summary increments amountMismatches for each affected transaction', async () => {
    global.fetch = vi
      .fn()
      // tx-1: stellar OK, base OK, paycrest amount differs
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0x1' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '50.00' } }),
      })
      // tx-2: stellar OK, base OK, paycrest amount differs
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0x2' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '75.00' } }),
      });

    const records = [
      makeRecord({ transactionId: 'tx-m1', amount: '100.00' }),
      makeRecord({ transactionId: 'tx-m2', amount: '100.00' }),
    ];
    const report = await generateReconciliationReport(records);
    expect(report.summary.amountMismatches).toBe(2);
  });
});

describe('#1350 — missing-ledger entry edge cases', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects missing Stellar transaction when stellarTxHash is provided but fetch fails', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false }) // stellar fetch fails
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xbase' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '100.00' } }),
      });

    const record = makeRecord({ amount: '100.00' });
    const results = await reconcileTransaction(record);
    const missing = results.find((r) => r.type === 'missing_stellar');
    expect(missing).toBeDefined();
    expect(missing?.severity).toBe('high');
    expect(missing?.description).toContain(record.stellarTxHash);
  });

  it('detects missing Base transaction when baseTxHash is provided but RPC returns null result', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: null }) }) // null result
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '100.00' } }),
      });

    const record = makeRecord({ amount: '100.00' });
    const results = await reconcileTransaction(record);
    const missing = results.find((r) => r.type === 'missing_base');
    expect(missing).toBeDefined();
    expect(missing?.severity).toBe('high');
  });

  it('detects missing Paycrest order when orderId is provided but fetch returns 404', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xbase' } }) })
      .mockResolvedValueOnce({ ok: false }); // paycrest 404

    const record = makeRecord({ amount: '100.00' });
    const results = await reconcileTransaction(record);
    const missing = results.find((r) => r.type === 'missing_paycrest');
    expect(missing).toBeDefined();
    expect(missing?.severity).toBe('medium');
    expect(missing?.description).toContain(record.paycrestOrderId);
  });

  it('skips missing_stellar check when record has no stellarTxHash', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xbase' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '100.00' } }),
      });

    // No stellar hash — should not report missing_stellar
    const record = makeRecord({ stellarTxHash: undefined, amount: '100.00' });
    const results = await reconcileTransaction(record);
    expect(results.find((r) => r.type === 'missing_stellar')).toBeUndefined();
  });

  it('skips missing_base check when record has no baseTxHash', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'completed', amount: '100.00' } }),
      });

    const record = makeRecord({ baseTxHash: undefined, amount: '100.00' });
    const results = await reconcileTransaction(record);
    expect(results.find((r) => r.type === 'missing_base')).toBeUndefined();
  });

  it('skips missing_paycrest check when record has no paycrestOrderId', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ successful: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { hash: '0xbase' } }) });

    const record = makeRecord({ paycrestOrderId: undefined, amount: '100.00' });
    const results = await reconcileTransaction(record);
    expect(results.find((r) => r.type === 'missing_paycrest')).toBeUndefined();
  });

  it('handles a record with ALL three hashes missing — no external fetches, no discrepancies', async () => {
    // When all three are absent the reconciler has nothing to check against
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const record = makeRecord({
      stellarTxHash: undefined,
      baseTxHash: undefined,
      paycrestOrderId: undefined,
    });

    const results = await reconcileTransaction(record);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(results).toHaveLength(0);
  });

  it('report summary counts missingStellar, missingBase, missingPaycrest separately', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const records = [
      makeRecord({ transactionId: 'tx-s1', stellarTxHash: 'shash-1' }),
      makeRecord({ transactionId: 'tx-b1', baseTxHash: '0xbase1' }),
      makeRecord({
        transactionId: 'tx-p1',
        paycrestOrderId: 'order-p1',
        stellarTxHash: undefined,
        baseTxHash: undefined,
      }),
    ];

    const report = await generateReconciliationReport(records);
    // Each record has one missing leg — counts should all be ≥ 1
    expect(report.summary.missingStellar).toBeGreaterThanOrEqual(1);
    expect(report.summary.missingBase).toBeGreaterThanOrEqual(1);
    expect(report.summary.missingPaycrest).toBeGreaterThanOrEqual(1);
  });

  it('fetch network error is treated as a missing entry (no throw, discrepancy added)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const record = makeRecord({ amount: '100.00' });
    // Should not throw; all three legs will be treated as missing
    const results = await reconcileTransaction(record);
    expect(results.some((r) => r.type === 'missing_stellar')).toBe(true);
  });
});

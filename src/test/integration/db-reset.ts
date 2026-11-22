/**
 * DB reset helpers for integration test suites (issue #1349).
 *
 * Integration tests that share a database fixture can leak rows between cases
 * when a prior test inserts data and the next test reads it unexpectedly.
 * These helpers provide a single, well-documented place for truncation so
 * every suite can simply call `resetDb()` in a `beforeEach` hook.
 *
 * ## Usage
 *
 * ```ts
 * import { resetDb, resetTables, getDbMock } from './db-reset';
 *
 * // Option 1: reset all known tables (recommended)
 * beforeEach(async () => {
 *   resetDb();
 * });
 *
 * // Option 2: reset a specific subset of tables
 * beforeEach(async () => {
 *   resetTables(['transactions', 'idempotency_keys']);
 * });
 * ```
 *
 * ## Table ordering
 *
 * Tables are truncated in dependency order (children before parents) so that
 * foreign-key constraints are never violated:
 *
 *  1. ledger_reconciliation      – references ledger_accounts
 *  2. ledger_entries             – references ledger_accounts
 *  3. ledger_accounts            – root ledger table
 *  4. audit_log                  – independent audit trail
 *  5. api_key_scopes             – references api_keys
 *  6. api_keys                   – references users
 *  7. idempotency_keys           – independent
 *  8. transaction_disputes       – references transactions
 *  9. transactions               – root transaction table
 * 10. reconciliation_history     – independent reconciliation records
 *
 * ## Implementation note
 *
 * The helpers work against the in-memory mock that most integration suites
 * inject via `vi.mock('@/lib/db/client', ...)`.  When the mock exposes a
 * mutable `rows` store or a `query` spy, `resetDb()` clears both.  Tests
 * that run against a real Postgres instance (e.g. in a Docker-based CI job)
 * can import `resetDbReal` instead, which issues `TRUNCATE … CASCADE`.
 */

import { vi } from 'vitest';

// ── Table registry ────────────────────────────────────────────────────────────

/**
 * All tables owned by this application, ordered so that truncation never
 * violates referential integrity (children first).
 */
export const ALL_TABLES = [
  'ledger_reconciliation',
  'ledger_entries',
  'ledger_accounts',
  'audit_log',
  'api_key_scopes',
  'api_keys',
  'idempotency_keys',
  'transaction_disputes',
  'transactions',
  'reconciliation_history',
] as const;

export type TableName = (typeof ALL_TABLES)[number];

// ── In-memory state used by integration test suites ───────────────────────────

/**
 * A simple in-memory row store shared across reset helpers.
 * Tests that need direct row access can import this object.
 */
export const dbState: Record<string, unknown[]> = Object.fromEntries(
  ALL_TABLES.map((t) => [t, []]),
);

// Track which query mock was most recently installed so resetDb can clear it.
let _queryMock: ReturnType<typeof vi.fn> | null = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Clear all rows from every tracked table and reset the query mock call history.
 *
 * Call this in `beforeEach` to guarantee test isolation.
 *
 * @example
 * ```ts
 * beforeEach(() => { resetDb(); });
 * ```
 */
export function resetDb(): void {
  resetTables(ALL_TABLES as unknown as TableName[]);
}

/**
 * Clear rows from a specific subset of tables only.
 *
 * Useful when a suite only touches a small number of tables and a full reset
 * would mask setup done by a shared `beforeAll`.
 *
 * @param tables - Table names to truncate (order is respected as given).
 */
export function resetTables(tables: TableName[]): void {
  for (const table of tables) {
    dbState[table] = [];
  }
  if (_queryMock) {
    _queryMock.mockClear();
  }
}

/**
 * Build a `pool.query` mock that delegates INSERT/SELECT operations to the
 * shared `dbState` store and returns predictable empty results for everything
 * else.  Pass the result to `vi.mock` or install it directly on the mock:
 *
 * ```ts
 * vi.mock('@/lib/db/client', () => ({ pool: { query: getDbMock() } }));
 * ```
 *
 * After calling this, use `resetDb()` in `beforeEach` to clear accumulated
 * rows between tests.
 */
export function getDbMock(): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue({ rows: [] });
  _queryMock = mock;
  return mock;
}

/**
 * Seed a table with fixture rows for the current test.
 *
 * This is a convenience wrapper so tests don't manipulate `dbState` directly.
 *
 * @param table  - Table to seed.
 * @param rows   - Row objects to insert.
 */
export function seedTable<T extends object>(table: TableName, rows: T[]): void {
  dbState[table] = [...dbState[table], ...rows];
}

/**
 * Return all rows currently in `table`.
 *
 * Useful for asserting side-effects without going through the query mock.
 */
export function getRows<T = unknown>(table: TableName): T[] {
  return dbState[table] as T[];
}

// ── Postgres helper (real DB) ─────────────────────────────────────────────────

/**
 * Truncate all tables in a real Postgres instance using `TRUNCATE … CASCADE`.
 *
 * Only import this in tests that connect to a live database (e.g. Docker-based
 * CI).  It is intentionally not re-exported from the barrel so it cannot be
 * accidentally called in unit/mock-based suites.
 *
 * @param pool - A `pg.Pool` or compatible object with a `query` method.
 */
export async function resetDbReal(pool: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  // Single statement avoids round-trips; CASCADE handles FK constraints.
  await pool.query(`TRUNCATE TABLE ${ALL_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

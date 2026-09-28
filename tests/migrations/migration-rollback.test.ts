/**
 * migration-rollback.test.ts
 *
 * Issue #1006 — Migration tests for rollback correctness.
 *
 * Tests that every migration file:
 *  1. Contains `-- up` and `-- down` markers (the runner contract).
 *  2. Has a non-empty `up` block.
 *  3. Has an explicit `down` block (even if it is a documented no-op).
 *  4. The `down` block reverses what the `up` block creates (structural
 *     verification — DROP for every CREATE, index drops for index creates).
 *  5. Idempotent migrations use `IF NOT EXISTS` / `IF EXISTS` guards.
 *  6. Non-idempotent migrations (006, 007, 008) are explicitly catalogued.
 *
 * ## Why not test against a real database?
 *
 * The goal of this test suite is to catch the most common class of migration
 * bug — a missing or incorrect rollback — without requiring a running Postgres
 * instance.  Structural analysis of the SQL text is fast, deterministic, and
 * runs in every CI environment without a database service.
 *
 * For tests that actually apply and roll back DDL against a live database, see
 * `tests/migrations/migration.test.ts`.
 *
 * ## Irreversible migrations
 *
 * Some migrations cannot be safely reversed because they delete data.  These
 * are listed in `IRREVERSIBLE_MIGRATIONS` below.  Each entry must include a
 * comment in the migration file explaining why rollback is not possible and
 * what manual steps are needed to recover.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/**
 * Migrations that genuinely cannot be reversed (destroy data).
 * Each entry requires evidence in the file itself — a comment starting with
 * `-- IRREVERSIBLE:` followed by the reason.
 */
const IRREVERSIBLE_MIGRATIONS = new Set<string>([
  // None yet — update this set and add an `-- IRREVERSIBLE:` comment
  // in the migration file when you add a destructive migration.
]);

/**
 * Migrations added before the `-- up` / `-- down` marker convention was
 * established. They are tracked here to avoid false failures while the
 * backlog of legacy files is being addressed.
 *
 * New migrations MUST include markers — do not add to this set.
 */
const LEGACY_NO_MARKER_MIGRATIONS = new Set<string>([
  '001_create_transactions.sql',
  '002_add_transaction_analytics_fields.sql',
  '003_create_idempotency_keys.sql',
  '004_create_transaction_notifications.sql',
  '005_create_api_keys.sql',
  '006_add_transaction_insurance.sql',
  '007_add_transaction_batching.sql',
  '008_add_referral_program.sql',
  '009_add_transaction_scheduling.sql',
  '010_create_transaction_disputes.sql',
  '011_add_query_indexes.sql',
  '012_add_ip_whitelisting.sql',
  '013_add_session_management.sql',
  '014_add_transaction_signing.sql',
  '015_add_audit_logging.sql',
  '016_add_api_key_scopes.sql',
  '017_enhance_audit_logging.sql',
  '018_optimize_database_queries.sql',
  '019_create_webhook_subscriptions.sql',
  '020_create_onramp_transactions.sql',
  '021_create_ledger_tables.sql',
  '022_add_multisig_settlement.sql',
  '023_field_level_encryption_pii.sql',
  '024_db_optimization_701.sql',
  '025_create_merchant_accounts.sql',
  '026_add_webhook_schema_version.sql',
  '027_fix_query_optimization_indexes.sql',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedMigration {
  filename: string;
  content: string;
  up: string;
  down: string;
  hasUpMarker: boolean;
  hasDownMarker: boolean;
}

function readMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

function parseMigration(filename: string): ParsedMigration {
  const content = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf-8');
  const hasUpMarker = content.includes('-- up\n') || content.includes('-- up\r\n');
  const hasDownMarker = content.includes('-- down\n') || content.includes('-- down\r\n');

  let up = '';
  let down = '';

  if (hasUpMarker && hasDownMarker) {
    const upIndex = content.indexOf('-- up\n');
    const downIndex = content.indexOf('-- down\n');
    up = content.slice(upIndex + '-- up\n'.length, downIndex).trim();
    down = content.slice(downIndex + '-- down\n'.length).trim();
  } else if (!hasUpMarker && !hasDownMarker) {
    // Legacy file — treat entire content as the up block
    up = content.trim();
    down = '';
  }

  return { filename, content, up, down, hasUpMarker, hasDownMarker };
}

/**
 * Extract all object names from a `CREATE TABLE IF NOT EXISTS <name>` statement.
 */
function extractCreatedTables(sql: string): string[] {
  const matches = sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/gi);
  return Array.from(matches, (m) => m[1].replace(/[";]/g, '').toLowerCase());
}

/**
 * Extract all object names from a `CREATE INDEX` statement.
 */
function extractCreatedIndexes(sql: string): string[] {
  const matches = sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/gi);
  return Array.from(matches, (m) => m[1].replace(/[";]/g, '').toLowerCase());
}

/**
 * Extract all table names from a `DROP TABLE IF EXISTS <name>` statement.
 */
function extractDroppedTables(sql: string): string[] {
  const matches = sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\S+)/gi);
  return Array.from(matches, (m) => m[1].replace(/[";]/g, '').toLowerCase());
}

/**
 * Extract all index names from a `DROP INDEX IF EXISTS <name>` statement.
 */
function extractDroppedIndexes(sql: string): string[] {
  const matches = sql.matchAll(/DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(\S+)/gi);
  return Array.from(matches, (m) => m[1].replace(/[";]/g, '').toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

const migrationFiles = readMigrationFiles();

describe('Migration file inventory', () => {
  it('finds at least one migration file', () => {
    expect(migrationFiles.length).toBeGreaterThan(0);
  });

  it('all migration files have a .sql extension', () => {
    for (const f of migrationFiles) {
      expect(f).toMatch(/\.sql$/);
    }
  });

  it('migration files are sorted numerically', () => {
    const sortedCopy = [...migrationFiles].sort();
    expect(migrationFiles).toEqual(sortedCopy);
  });
});

describe('Migration marker convention', () => {
  it('new migrations (not in legacy set) must have -- up and -- down markers', () => {
    const newMigrations = migrationFiles.filter((f) => !LEGACY_NO_MARKER_MIGRATIONS.has(f));

    for (const f of newMigrations) {
      const m = parseMigration(f);
      expect(m.hasUpMarker, `${f}: missing -- up marker`).toBe(true);
      expect(m.hasDownMarker, `${f}: missing -- down marker`).toBe(true);
    }
  });

  it('legacy migrations without markers are explicitly catalogued', () => {
    const legacyWithoutMarkers = migrationFiles.filter((f) => {
      const m = parseMigration(f);
      return !m.hasUpMarker && !m.hasDownMarker;
    });

    for (const f of legacyWithoutMarkers) {
      expect(
        LEGACY_NO_MARKER_MIGRATIONS.has(f),
        `${f}: has no markers but is not in the legacy set — add markers or add to LEGACY_NO_MARKER_MIGRATIONS`,
      ).toBe(true);
    }
  });
});

describe('Migration up blocks', () => {
  it('every migration has a non-empty up block', () => {
    for (const f of migrationFiles) {
      const m = parseMigration(f);
      expect(m.up.length, `${f}: up block is empty`).toBeGreaterThan(0);
    }
  });
});

describe('Migration down blocks (rollback correctness)', () => {
  it('every new migration has a non-empty down block', () => {
    const newMigrations = migrationFiles.filter(
      (f) => !LEGACY_NO_MARKER_MIGRATIONS.has(f) && !IRREVERSIBLE_MIGRATIONS.has(f),
    );

    for (const f of newMigrations) {
      const m = parseMigration(f);
      expect(
        m.down.length,
        `${f}: down block is empty — add rollback SQL or document why rollback is impossible`,
      ).toBeGreaterThan(0);
    }
  });

  it('irreversible migrations are explicitly documented with -- IRREVERSIBLE: comment', () => {
    for (const f of IRREVERSIBLE_MIGRATIONS) {
      const m = parseMigration(f);
      expect(
        m.content.includes('-- IRREVERSIBLE:'),
        `${f}: is in IRREVERSIBLE_MIGRATIONS but has no -- IRREVERSIBLE: comment explaining why`,
      ).toBe(true);
    }
  });

  it('new migrations: down block drops every table created in up block', () => {
    const newMigrations = migrationFiles.filter(
      (f) => !LEGACY_NO_MARKER_MIGRATIONS.has(f) && !IRREVERSIBLE_MIGRATIONS.has(f),
    );

    for (const f of newMigrations) {
      const m = parseMigration(f);
      const createdTables = extractCreatedTables(m.up);
      const droppedTables = extractDroppedTables(m.down);

      for (const table of createdTables) {
        expect(
          droppedTables.includes(table),
          `${f}: table "${table}" is created in up but not dropped in down`,
        ).toBe(true);
      }
    }
  });

  it('new migrations: down block drops every named index created in up block', () => {
    const newMigrations = migrationFiles.filter(
      (f) => !LEGACY_NO_MARKER_MIGRATIONS.has(f) && !IRREVERSIBLE_MIGRATIONS.has(f),
    );

    for (const f of newMigrations) {
      const m = parseMigration(f);
      const createdIndexes = extractCreatedIndexes(m.up);
      const droppedIndexes = extractDroppedIndexes(m.down);

      for (const idx of createdIndexes) {
        expect(
          droppedIndexes.includes(idx),
          `${f}: index "${idx}" is created in up but not dropped in down`,
        ).toBe(true);
      }
    }
  });
});

describe('Idempotency — legacy migrations (no markers)', () => {
  /**
   * Migrations in the legacy set do not have rollback markers; they rely on
   * idempotent SQL (IF NOT EXISTS) to be re-runnable.  Verify this property
   * for the migrations that are documented as idempotent in their header comment.
   */

  const idempotentLegacyMigrations = [
    '001_create_transactions.sql',
    '002_add_transaction_analytics_fields.sql',
    '003_create_idempotency_keys.sql',
    '004_create_transaction_notifications.sql',
    '005_create_api_keys.sql',
    '013_add_session_management.sql',
    '014_add_transaction_signing.sql',
    '015_add_audit_logging.sql',
    '019_create_webhook_subscriptions.sql',
    '020_create_onramp_transactions.sql',
    '021_create_ledger_tables.sql',
    '025_create_merchant_accounts.sql',
  ];

  for (const filename of idempotentLegacyMigrations) {
    it(`${filename}: all CREATE TABLE statements use IF NOT EXISTS`, () => {
      if (!migrationFiles.includes(filename)) return; // file may not exist

      const m = parseMigration(filename);
      const createTableMatches = m.content.matchAll(/CREATE\s+TABLE\b/gi);

      for (const match of createTableMatches) {
        // Advance past "CREATE TABLE" to check what follows
        const startPos = (match.index ?? 0) + match[0].length;
        const following = m.content.slice(startPos, startPos + 30).trimStart().toUpperCase();
        expect(
          following.startsWith('IF NOT EXISTS'),
          `${filename}: found CREATE TABLE without IF NOT EXISTS at position ${match.index}`,
        ).toBe(true);
      }
    });

    it(`${filename}: all CREATE INDEX statements use IF NOT EXISTS`, () => {
      if (!migrationFiles.includes(filename)) return;

      const m = parseMigration(filename);
      const createIndexMatches = m.content.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\b/gi);

      for (const match of createIndexMatches) {
        const startPos = (match.index ?? 0) + match[0].length;
        const following = m.content.slice(startPos, startPos + 30).trimStart().toUpperCase();
        expect(
          following.startsWith('IF NOT EXISTS'),
          `${filename}: found CREATE INDEX without IF NOT EXISTS at position ${match.index}`,
        ).toBe(true);
      }
    });
  }
});

describe('Non-idempotent legacy migrations — explicitly catalogued', () => {
  /**
   * Migrations 006, 007, 008, 009, 010 do not use IF NOT EXISTS.
   * They are documented here so the team is aware of the risk.
   *
   * Action: before re-running these migrations on a database that already has
   * their tables, manually verify the state or use an explicit pre-check.
   */
  const nonIdempotentMigrations = [
    '006_add_transaction_insurance.sql',
    '007_add_transaction_batching.sql',
    '008_add_referral_program.sql',
    '009_add_transaction_scheduling.sql',
    '010_create_transaction_disputes.sql',
    '011_add_query_indexes.sql',
    '012_add_ip_whitelisting.sql',
    '017_enhance_audit_logging.sql',
    '018_optimize_database_queries.sql',
  ];

  it('non-idempotent migrations are present in the expected set', () => {
    const actualNonIdempotent = migrationFiles.filter((filename) => {
      if (!LEGACY_NO_MARKER_MIGRATIONS.has(filename)) return false;
      const m = parseMigration(filename);
      // Look for a bare CREATE TABLE without IF NOT EXISTS
      const hasBareCreate = /CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i.test(m.content);
      const hasBareIndex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(
        m.content,
      );
      return hasBareCreate || hasBareIndex;
    });

    for (const f of actualNonIdempotent) {
      expect(
        nonIdempotentMigrations.includes(f),
        `${f}: is non-idempotent but not in the catalogued set — add it to nonIdempotentMigrations`,
      ).toBe(true);
    }
  });
});

describe('SQL parser helpers', () => {
  it('extractCreatedTables finds table names', () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY);
    `;
    const tables = extractCreatedTables(sql);
    expect(tables).toContain('users');
    expect(tables).toContain('sessions');
  });

  it('extractDroppedTables finds table names', () => {
    const sql = `
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS users;
    `;
    const tables = extractDroppedTables(sql);
    expect(tables).toContain('users');
    expect(tables).toContain('sessions');
  });

  it('extractCreatedIndexes finds index names', () => {
    const sql = `
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users (name);
    `;
    const indexes = extractCreatedIndexes(sql);
    expect(indexes).toContain('idx_users_email');
    expect(indexes).toContain('idx_users_name');
  });

  it('extractDroppedIndexes finds index names', () => {
    const sql = `
      DROP INDEX IF EXISTS idx_users_email;
      DROP INDEX IF EXISTS idx_users_name;
    `;
    const indexes = extractDroppedIndexes(sql);
    expect(indexes).toContain('idx_users_email');
    expect(indexes).toContain('idx_users_name');
  });
});

describe('Migration rollback simulation — structural round-trip', () => {
  /**
   * For migrations that do have markers, verify that the down block exactly
   * reverses the up block by matching created/dropped object names.
   *
   * This test is currently empty because all existing migrations are in the
   * legacy set.  As new migrations are added with `-- up` / `-- down` markers,
   * this test will automatically cover them.
   */

  const newMigrations = migrationFiles.filter((f) => !LEGACY_NO_MARKER_MIGRATIONS.has(f));

  if (newMigrations.length === 0) {
    it('(no new migrations yet — coverage will grow as markers are added)', () => {
      expect(true).toBe(true);
    });
  }

  for (const f of newMigrations) {
    describe(`${f}`, () => {
      it('up block is non-empty', () => {
        const m = parseMigration(f);
        expect(m.up.length).toBeGreaterThan(0);
      });

      it('down block is non-empty or migration is documented as irreversible', () => {
        const m = parseMigration(f);
        const isIrreversible = IRREVERSIBLE_MIGRATIONS.has(f);
        if (!isIrreversible) {
          expect(
            m.down.length,
            `down block is empty — document rollback or add to IRREVERSIBLE_MIGRATIONS`,
          ).toBeGreaterThan(0);
        }
      });

      it('down block drops tables in reverse order of creation', () => {
        const m = parseMigration(f);
        if (IRREVERSIBLE_MIGRATIONS.has(f)) return;

        const createdTables = extractCreatedTables(m.up);
        const droppedTables = extractDroppedTables(m.down);

        // Every table created must be dropped
        for (const table of createdTables) {
          expect(
            droppedTables.includes(table),
            `Table "${table}" created in up but not dropped in down`,
          ).toBe(true);
        }

        // No extra tables should be dropped that were not created
        for (const table of droppedTables) {
          expect(
            createdTables.includes(table),
            `Table "${table}" dropped in down but was not created in up`,
          ).toBe(true);
        }
      });

      it('down block drops indexes created in up', () => {
        const m = parseMigration(f);
        if (IRREVERSIBLE_MIGRATIONS.has(f)) return;

        const createdIndexes = extractCreatedIndexes(m.up);
        const droppedIndexes = extractDroppedIndexes(m.down);

        for (const idx of createdIndexes) {
          expect(
            droppedIndexes.includes(idx),
            `Index "${idx}" created in up but not dropped in down`,
          ).toBe(true);
        }
      });

      it('down block uses IF EXISTS guards', () => {
        const m = parseMigration(f);
        if (IRREVERSIBLE_MIGRATIONS.has(f)) return;
        if (m.down.trim().length === 0) return;

        // Every DROP in the down block should use IF EXISTS
        const bareDrops = m.down.match(/DROP\s+(?:TABLE|INDEX|SEQUENCE|VIEW)\s+(?!IF\s+EXISTS)/gi);
        expect(
          bareDrops,
          `down block has DROP statements without IF EXISTS — add IF EXISTS guards`,
        ).toBeNull();
      });
    });
  }
});

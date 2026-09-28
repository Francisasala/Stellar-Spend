#!/usr/bin/env node

/**
 * Database Migration Script
 * Supports zero-downtime rolling deploys with expand/contract pattern
 */

import { Pool, type QueryResult } from 'pg';
import fs from 'fs';
import { lintMigrationSql } from '../migrations/lint/rules';

const info = (...msgs: unknown[]) => process.stdout.write(msgs.join(' ') + '\n');
const fail = (...msgs: unknown[]) => process.stderr.write(msgs.join(' ') + '\n');
const warn = (...msgs: unknown[]) => process.stderr.write(msgs.join(' ') + '\n');

interface Migration {
  id: string;
  name: string;
  up: string;
  down: string;
  applied: boolean;
  applied_at?: Date;
}

class MigrationRunner {
  private pool: Pool;
  private dryRun: boolean = false;
  private verbose: boolean = false;

  constructor(dryRun: boolean = false, verbose: boolean = false) {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this.dryRun = dryRun;
    this.verbose = verbose;
  }

  async initialize(): Promise<void> {
    // Create migrations table if it doesn't exist
    await this.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64)
      );
    `);

    await this.reconcileLegacyIds();
  }

  // Older rows were keyed by bare numeric filename prefix (e.g. "010"), which
  // breaks the moment two files share a prefix (see migrations/README.md).
  // Re-key any such legacy row to the filename slug with the number
  // stripped, derived from the already-recorded `name` column, so renaming
  // migration files to fix numbering never desyncs applied-migration
  // tracking again. Safe to run on every startup: once a row's id is no
  // longer purely numeric this is a no-op for it.
  async reconcileLegacyIds(): Promise<void> {
    await this.query(`
      UPDATE schema_migrations
      SET id = regexp_replace(name, '^[0-9]+_', '')
      WHERE id ~ '^[0-9]+$'
    `);
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (this.dryRun) {
      info(`[DRY RUN] Would execute: ${sql.substring(0, 200)}...`);
      return { rows: [] };
    }

    if (this.verbose) {
      info(`[VERBOSE] Executing: ${sql.substring(0, 100)}...`);
    }

    const result = await this.pool.query(sql, params);
    return result;
  }

  async getAppliedMigrations(): Promise<Migration[]> {
    const result = await this.query(`
      SELECT id, name, applied_at 
      FROM schema_migrations 
      ORDER BY id
    `);

    return result.rows.map((row: { id: string; name: string; applied_at?: Date }) => ({
      id: row.id,
      name: row.name,
      applied: true,
      applied_at: row.applied_at,
    }));
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const applied = await this.getAppliedMigrations();
    const appliedIds = new Set(applied.map((m) => m.id));

    // Read migration files
    const migrationFiles = fs
      .readdirSync('./migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of migrationFiles) {
      const name = file.replace(/\.sql$/, '');
      // Stable across renumbering: derived from the descriptive part of the
      // filename, not the numeric prefix. See reconcileLegacyIds().
      const id = name.replace(/^\d+_/, '');

      if (!appliedIds.has(id)) {
        const content = fs.readFileSync(`./migrations/${file}`, 'utf-8');
        const [up, down] = this.extractUpDown(content);

        migrations.push({
          id,
          name,
          up,
          down,
          applied: false,
        });
      }
    }

    return migrations;
  }

  extractUpDown(content: string): [string, string] {
    const upMatch = content.match(/-- up\s*([\s\S]*?)-- down/);
    const downMatch = content.match(/-- down\s*([\s\S]*?)$/);

    const up = upMatch ? upMatch[1].trim() : '';
    const down = downMatch ? downMatch[1].trim() : '';

    return [up, down];
  }

  async applyMigration(migration: Migration): Promise<void> {
    // Phase 1: Expand (add new columns/tables)
    info(`[EXPAND] Applying ${migration.name}...`);

    // Check if migration is safe (no blocking locks)
    const isSafe = this.lintMigration(migration.up);
    if (!isSafe) {
      fail(`❌ Migration ${migration.name} failed linting!`);
      throw new Error('Migration safety check failed');
    }

    // Execute up migration
    await this.query(migration.up);

    // Record migration
    await this.query(
      `
      INSERT INTO schema_migrations (id, name, checksum)
      VALUES ($1, $2, $3)
    `,
      [migration.id, migration.name, this.calculateChecksum(migration.up)],
    );

    // Phase 2: Contract (remove old columns/tables after validation)
    // This is handled in a separate migration step (deprecated phase)

    info(`✅ Migration ${migration.name} applied successfully`);
  }

  async rollbackMigration(migration: Migration): Promise<void> {
    info(`[CONTRACT] Rolling back ${migration.name}...`);

    // Execute down migration
    await this.query(migration.down);

    // Remove migration record
    await this.query(
      `
      DELETE FROM schema_migrations WHERE id = $1
    `,
      [migration.id],
    );

    info(`✅ Migration ${migration.name} rolled back successfully`);
  }

  lintMigration(sql: string): boolean {
    const result = lintMigrationSql(sql);

    for (const violation of result.violations) {
      warn(`⚠️ Unsafe pattern detected: ${violation}`);
    }
    if (result.violations.some((v) => v.includes('DROP') || v.includes('TRUNCATE'))) {
      warn(
        '   Destructive operations require an "-- lint:allow-destructive" comment in the migration to proceed.',
      );
    }
    for (const override of result.overridden) {
      warn(`⚠️ Destructive operation allowed via override: ${override}`);
    }

    return result.safe;
  }

  calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async run(): Promise<void> {
    info('🔍 Checking pending migrations...');

    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      info('✅ No pending migrations');
      return;
    }

    info(`📋 Found ${pending.length} pending migrations:`);
    for (const migration of pending) {
      info(`  - ${migration.name} (${migration.id})`);
    }

    // Run migrations
    for (const migration of pending) {
      await this.applyMigration(migration);
    }

    info('✅ All migrations applied successfully');
  }

  async rollback(steps: number = 1): Promise<void> {
    info(`🔍 Rolling back ${steps} migration(s)...`);

    const applied = await this.getAppliedMigrations();

    if (applied.length === 0) {
      info('✅ No migrations to rollback');
      return;
    }

    const toRollback = applied.slice(-steps);

    for (const migration of toRollback) {
      const migrationFile = migration.name + '.sql';
      const content = fs.readFileSync(`./migrations/${migrationFile}`, 'utf-8');
      const [up, down] = this.extractUpDown(content);

      await this.rollbackMigration({
        ...migration,
        up,
        down,
        applied: true,
      });
    }

    info(`✅ Rolled back ${toRollback.length} migration(s)`);
  }

  async dryRunMigrations(): Promise<void> {
    info('🔍 DRY RUN: Checking migrations...');
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      info('✅ No pending migrations');
      return;
    }

    info(`📋 Would apply ${pending.length} migrations:`);
    for (const migration of pending) {
      info(`  - ${migration.name} (${migration.id})`);
      info(`    UP: ${migration.up.substring(0, 100)}...`);
    }
  }

  async verifyRollback(migrationId: string): Promise<boolean> {
    info(`🔍 Verifying rollback for ${migrationId}...`);

    // Apply migration
    const pending = await this.getPendingMigrations();
    const migration = pending.find((m) => m.id === migrationId);

    if (!migration) {
      info(`⚠️ Migration ${migrationId} not found or already applied`);
      return false;
    }

    // Apply
    await this.applyMigration(migration);

    // Rollback
    await this.rollbackMigration(migration);

    // Verify rollback completed
    const applied = await this.getAppliedMigrations();
    const found = applied.find((m) => m.id === migrationId);

    if (!found) {
      info(`✅ Rollback verification passed for ${migrationId}`);
      return true;
    } else {
      info(`❌ Rollback verification failed for ${migrationId}`);
      return false;
    }
  }

  async lintAllMigrations(): Promise<boolean> {
    info('🔍 Linting migration files against safety rules...');
    const files = fs
      .readdirSync('./migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let allPassed = true;
    for (const file of files) {
      const content = fs.readFileSync(`./migrations/${file}`, 'utf-8');
      const [up] = this.extractUpDown(content);
      const isSafe = this.lintMigration(up || content);
      if (!isSafe) {
        fail(`❌ Migration ${file} failed linting!`);
        allPassed = false;
      }
    }

    if (allPassed) {
      info('✅ Linting passed for all migrations');
      return true;
    } else {
      throw new Error('Migration linting failed');
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// CLI Handler
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'up';
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  const runner = new MigrationRunner(dryRun, verbose);

  try {
    if (command !== 'lint') {
      await runner.initialize();
    }

    switch (command) {
      case 'up':
        await runner.run();
        break;

      case 'down':
        const steps = parseInt(args[1]) || 1;
        await runner.rollback(steps);
        break;

      case 'dry-run':
        await runner.dryRunMigrations();
        break;

      case 'lint':
        await runner.lintAllMigrations();
        break;

      case 'verify':
        const migrationId = args[1];
        if (!migrationId) {
          fail('❌ Migration ID required for verify command');
          process.exit(1);
        }
        await runner.verifyRollback(migrationId);
        break;

      default:
        info(`
Usage: migrate.ts [command] [options]

Commands:
  up                    Apply pending migrations
  down [steps]          Rollback migrations (default: 1)
  dry-run               Show pending migrations without applying
  verify <id>           Verify rollback for a specific migration
  lint                  Check migration files against safety rules

Options:
  --dry-run             Simulate migration without applying
  --verbose             Show detailed output
        `);
    }
  } catch (error) {
    fail('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (command !== 'lint') {
      await runner.close();
    }
  }
}

main();

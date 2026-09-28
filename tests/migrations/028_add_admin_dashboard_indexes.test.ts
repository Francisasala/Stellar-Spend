import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MIGRATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'migrations',
  '028_add_admin_dashboard_indexes.sql',
);

describe('028_add_admin_dashboard_indexes migration', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  it('exists and is idempotent (uses IF NOT EXISTS everywhere)', () => {
    const createIndexStatements = sql.match(/CREATE INDEX[^;]+;/gi) ?? [];
    expect(createIndexStatements.length).toBeGreaterThan(0);
    for (const statement of createIndexStatements) {
      expect(statement).toMatch(/CREATE INDEX IF NOT EXISTS/i);
    }
  });

  it('adds a composite index covering audit_logs by action_type and recency', () => {
    expect(sql).toMatch(/idx_audit_logs_action_type_created_at/);
    expect(sql).toMatch(/ON audit_logs \(action_type, created_at DESC\)/);
  });

  it('adds a composite index covering admin_actions by action_type and recency', () => {
    expect(sql).toMatch(/idx_admin_actions_action_type_created_at/);
    expect(sql).toMatch(/ON admin_actions \(action_type, created_at DESC\)/);
  });

  it('adds a composite index covering webhook_subscriptions by status and recency', () => {
    expect(sql).toMatch(/idx_webhook_subscriptions_status_created_at/);
    expect(sql).toMatch(/ON webhook_subscriptions \(status, created_at DESC\)/);
  });

  it('adds an index covering api_key_usage_events time-window scans', () => {
    expect(sql).toMatch(/idx_api_key_usage_events_used_at/);
    expect(sql).toMatch(/ON api_key_usage_events \(used_at DESC\)/);
  });

  it('does not drop or alter any existing table', () => {
    expect(sql).not.toMatch(/DROP TABLE|ALTER TABLE.*DROP COLUMN/i);
  });
});

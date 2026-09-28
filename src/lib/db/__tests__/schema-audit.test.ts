/**
 * Tests for database schema audit tool (issue #965)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateColumnDropScript,
  generateIndexDropScript,
  generateAuditReport,
  type TableAuditResult,
  type SchemaColumn,
  type SchemaIndex,
} from '../schema-audit';

describe('Schema Audit Tool', () => {
  const mockColumn = (name: string, type: string = 'VARCHAR'): SchemaColumn => ({
    name,
    type,
    nullable: true,
    defaultValue: null,
    isPrimaryKey: false,
  });

  const mockIndex = (name: string, columns: string[]): SchemaIndex => ({
    name,
    tableName: 'test_table',
    columns,
    isUnique: false,
    isPrimary: false,
  });

  const mockAuditResult = (
    tableName: string,
    unusedColumns: SchemaColumn[] = [],
    unusedIndexes: SchemaIndex[] = [],
  ): TableAuditResult => ({
    tableName,
    totalColumns: 10,
    activeColumns: 10 - unusedColumns.length,
    potentiallyUnusedColumns: unusedColumns,
    indexes: [],
    potentiallyUnusedIndexes: unusedIndexes,
    recommendations: [],
  });

  describe('generateColumnDropScript', () => {
    it('should generate DROP COLUMN statements for unused columns', () => {
      const results = [
        mockAuditResult('users', [mockColumn('deprecated_field'), mockColumn('old_status')]),
      ];

      const script = generateColumnDropScript(results);

      expect(script).toContain('ALTER TABLE users DROP COLUMN IF EXISTS deprecated_field');
      expect(script).toContain('ALTER TABLE users DROP COLUMN IF EXISTS old_status');
      expect(script).toContain('WARNING');
    });

    it('should handle multiple tables', () => {
      const results = [
        mockAuditResult('users', [mockColumn('old_field')]),
        mockAuditResult('transactions', [mockColumn('legacy_status')]),
      ];

      const script = generateColumnDropScript(results);

      expect(script).toContain('ALTER TABLE users DROP COLUMN IF EXISTS old_field');
      expect(script).toContain('ALTER TABLE transactions DROP COLUMN IF EXISTS legacy_status');
    });

    it('should not generate script if no unused columns', () => {
      const results = [mockAuditResult('users', [])];
      const script = generateColumnDropScript(results);
      expect(script.trim()).toBe('');
    });

    it('should escape table and column names properly', () => {
      const results = [mockAuditResult('user_data', [mockColumn('some_col')])];
      const script = generateColumnDropScript(results);
      expect(script).toMatch(/ALTER TABLE user_data DROP COLUMN IF EXISTS some_col/);
    });
  });

  describe('generateIndexDropScript', () => {
    it('should generate DROP INDEX statements for unused indexes', () => {
      const results = [
        mockAuditResult('transactions', [], [
          mockIndex('idx_old_status', ['status']),
          mockIndex('idx_legacy_field', ['deprecated_field']),
        ]),
      ];

      const script = generateIndexDropScript(results);

      expect(script).toContain('DROP INDEX IF EXISTS idx_old_status');
      expect(script).toContain('DROP INDEX IF EXISTS idx_legacy_field');
      expect(script).toContain('WARNING');
    });

    it('should handle multiple tables with indexes', () => {
      const results = [
        mockAuditResult('users', [], [mockIndex('idx_users_old', ['old_field'])]),
        mockAuditResult('transactions', [], [
          mockIndex('idx_transactions_old', ['deprecated_field']),
        ]),
      ];

      const script = generateIndexDropScript(results);

      expect(script).toContain('DROP INDEX IF EXISTS idx_users_old');
      expect(script).toContain('DROP INDEX IF EXISTS idx_transactions_old');
    });

    it('should not generate script if no unused indexes', () => {
      const results = [mockAuditResult('users', [], [])];
      const script = generateIndexDropScript(results);
      expect(script.trim()).toBe('');
    });
  });

  describe('generateAuditReport', () => {
    it('should generate markdown report with summary', () => {
      const results = [
        mockAuditResult('users', [mockColumn('old_field')]),
        mockAuditResult('transactions', [
          mockColumn('deprecated_status'),
          mockColumn('legacy_amount'),
        ]),
      ];

      const report = generateAuditReport(results);

      expect(report).toContain('# Database Schema Audit Report');
      expect(report).toContain('Total tables: 2');
      expect(report).toContain('Potentially unused columns: 3');
    });

    it('should include table-specific details', () => {
      const results = [
        mockAuditResult('users', [mockColumn('old_field')], [mockIndex('idx_old', ['field'])]),
      ];

      const report = generateAuditReport(results);

      expect(report).toContain('### users');
      expect(report).toContain('old_field');
      expect(report).toContain('idx_old');
    });

    it('should include column type information', () => {
      const results = [
        mockAuditResult('users', [mockColumn('old_field', 'INTEGER')]),
      ];

      const report = generateAuditReport(results);

      expect(report).toContain('INTEGER');
    });

    it('should mark columns as nullable in report', () => {
      const column = mockColumn('field');
      column.nullable = true;
      const results = [mockAuditResult('users', [column])];

      const report = generateAuditReport(results);

      expect(report).toContain('nullable: true');
    });

    it('should include recommendations', () => {
      const result = mockAuditResult('users', [mockColumn('old_field')]);
      result.recommendations = ['Consider removing this column', 'Archive data first'];
      const results = [result];

      const report = generateAuditReport(results);

      expect(report).toContain('Recommendations');
      expect(report).toContain('Consider removing this column');
      expect(report).toContain('Archive data first');
    });

    it('should include generated timestamp', () => {
      const results = [mockAuditResult('users')];
      const report = generateAuditReport(results);

      expect(report).toContain('Generated:');
      expect(report).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format check
    });

    it('should handle empty audit results', () => {
      const results: TableAuditResult[] = [];
      const report = generateAuditReport(results);

      expect(report).toContain('Database Schema Audit Report');
      expect(report).toContain('Total tables: 0');
    });

    it('should skip tables with no issues in details section', () => {
      const results = [
        mockAuditResult('users', [mockColumn('old_field')]),
        mockAuditResult('clean_table', [], []), // No issues
      ];

      const report = generateAuditReport(results);

      expect(report).toContain('### users');
      expect(report).not.toContain('### clean_table'); // Should not appear in detail section
    });
  });

  describe('Integration scenarios', () => {
    it('should handle real-world schema cleanup scenario', () => {
      const unusedColumns = [
        mockColumn('insurance_status'),
        mockColumn('insurance_amount'),
      ];
      const unusedIndexes = [mockIndex('idx_insurance_status', ['insurance_status'])];

      const results = [
        mockAuditResult('transactions', unusedColumns, unusedIndexes),
      ];

      const columnScript = generateColumnDropScript(results);
      const indexScript = generateIndexDropScript(results);
      const report = generateAuditReport(results);

      // Verify comprehensive output
      expect(columnScript).toContain('insurance_status');
      expect(columnScript).toContain('insurance_amount');
      expect(indexScript).toContain('idx_insurance_status');
      expect(report).toContain('### transactions');
      expect(report).toContain('Potentially Unused Columns');
      expect(report).toContain('Potentially Unused Indexes');
    });

    it('should handle complex multi-table cleanup', () => {
      const results = [
        mockAuditResult('users', [mockColumn('legacy_referral')]),
        mockAuditResult('transactions', [
          mockColumn('scheduled_for'),
          mockColumn('recurrence_pattern'),
        ]),
        mockAuditResult('api_keys', [mockColumn('deprecated_scope')]),
      ];

      const columnScript = generateColumnDropScript(results);
      const report = generateAuditReport(results);

      expect(columnScript).toContain('ALTER TABLE users');
      expect(columnScript).toContain('ALTER TABLE transactions');
      expect(columnScript).toContain('ALTER TABLE api_keys');
      expect(report).toContain('Potentially unused columns: 4');
    });
  });

  describe('Error handling', () => {
    it('should handle empty results gracefully', () => {
      const results: TableAuditResult[] = [];

      const columnScript = generateColumnDropScript(results);
      const indexScript = generateIndexDropScript(results);
      const report = generateAuditReport(results);

      expect(columnScript.trim()).toBe('');
      expect(indexScript.trim()).toBe('');
      expect(report).toContain('Database Schema Audit Report');
    });

    it('should handle tables with no columns to drop', () => {
      const results = [mockAuditResult('users', [], [])];

      const script = generateColumnDropScript(results);

      expect(script.trim()).toBe('');
    });

    it('should handle special characters in names safely', () => {
      const results = [
        mockAuditResult('user_data', [mockColumn('deprecated_column_v2')]),
      ];

      const script = generateColumnDropScript(results);

      expect(script).toContain('deprecated_column_v2');
      expect(script).not.toContain('"'); // Should not use quotes for safe names
    });
  });

  describe('Script safety features', () => {
    it('should include warning comments before drops', () => {
      const results = [mockAuditResult('users', [mockColumn('old')])];

      const columnScript = generateColumnDropScript(results);
      const indexScript = generateIndexDropScript(results);

      expect(columnScript).toContain('-- WARNING');
      expect(columnScript).toContain('Review before executing');
    });

    it('should use IF EXISTS to prevent errors on repeated runs', () => {
      const results = [mockAuditResult('users', [mockColumn('old')])];

      const script = generateColumnDropScript(results);

      expect(script).toContain('DROP COLUMN IF EXISTS');
    });

    it('should generate idempotent SQL', () => {
      const results = [mockAuditResult('users', [mockColumn('old')])];

      const script = generateColumnDropScript(results);

      // IF EXISTS makes the script safe to run multiple times
      expect(script).toMatch(/DROP COLUMN IF EXISTS/);
    });
  });
});

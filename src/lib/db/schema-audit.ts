/**
 * Database schema audit tool (issue #965)
 * Identifies unused columns and indexes by comparing schema against ORM models
 */

import { pool } from './client';

/**
 * Schema column definition
 */
export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

/**
 * Schema index definition
 */
export interface SchemaIndex {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

/**
 * Usage statistics for a column
 */
export interface ColumnUsageStats {
  column: SchemaColumn;
  usageCount: number;
  lastUsedAt: Date | null;
  isActive: boolean;
}

/**
 * Audit result for a table
 */
export interface TableAuditResult {
  tableName: string;
  totalColumns: number;
  activeColumns: number;
  potentiallyUnusedColumns: SchemaColumn[];
  indexes: SchemaIndex[];
  potentiallyUnusedIndexes: SchemaIndex[];
  recommendations: string[];
}

/**
 * Get all tables in the database
 */
export async function getAllTables(): Promise<string[]> {
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  return result.rows.map(row => row.table_name);
}

/**
 * Get columns for a specific table
 */
export async function getTableColumns(tableName: string): Promise<SchemaColumn[]> {
  const result = await pool.query(
    `SELECT
       column_name as name,
       data_type as type,
       is_nullable = 'YES' as nullable,
       column_default as "defaultValue",
       false as "isPrimaryKey"
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName],
  );

  // Get primary key info
  const pkResult = await pool.query(
    `SELECT a.attname
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid
         AND a.attnum = ANY(i.indkey)
     WHERE i.indisprimary
     AND i.indrelid = $1::regclass`,
    [tableName],
  );

  const primaryKeyColumns = new Set(pkResult.rows.map(row => row.attname));

  return result.rows.map(row => ({
    name: row.name,
    type: row.type,
    nullable: row.nullable,
    defaultValue: row.defaultValue,
    isPrimaryKey: primaryKeyColumns.has(row.name),
  }));
}

/**
 * Get indexes for a specific table
 */
export async function getTableIndexes(tableName: string): Promise<SchemaIndex[]> {
  const result = await pool.query(
    `SELECT
       i.relname as "indexName",
       a.attname as "columnName",
       ix.indisunique as "isUnique",
       ix.indisprimary as "isPrimary"
     FROM pg_index ix
     JOIN pg_class i ON i.oid = ix.indexrelid
     JOIN pg_class t ON t.oid = ix.indrelid
     JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
     WHERE t.relname = $1
     ORDER BY i.relname, a.attnum`,
    [tableName],
  );

  // Group by index name
  const indexMap = new Map<string, SchemaIndex>();
  for (const row of result.rows) {
    const key = row.indexName;
    if (!indexMap.has(key)) {
      indexMap.set(key, {
        name: row.indexName,
        tableName,
        columns: [],
        isUnique: row.isUnique,
        isPrimary: row.isPrimary,
      });
    }
    indexMap.get(key)!.columns.push(row.columnName);
  }

  return Array.from(indexMap.values());
}

/**
 * Query PostgreSQL statistics for column usage
 * Note: This requires pg_stat_statements extension to be installed
 */
export async function getColumnUsageStats(tableName: string): Promise<ColumnUsageStats[]> {
  const columns = await getTableColumns(tableName);

  // Try to get usage stats from pg_stat_statements if available
  try {
    const statsResult = await pool.query(
      `SELECT query FROM pg_stat_statements
       WHERE query ILIKE $1
       LIMIT 100`,
      [`%${tableName}%`],
    );

    // For each column, check if it appears in any query
    const usageStats: ColumnUsageStats[] = [];
    for (const column of columns) {
      const isUsed = statsResult.rows.some(row =>
        row.query.toLowerCase().includes(column.name.toLowerCase()),
      );

      usageStats.push({
        column,
        usageCount: isUsed ? 1 : 0,
        lastUsedAt: isUsed ? new Date() : null,
        isActive: isUsed || column.isPrimaryKey || !column.nullable,
      });
    }

    return usageStats;
  } catch {
    // If pg_stat_statements is not available, return conservative estimates
    // (mark all columns as active to be safe)
    return columns.map(column => ({
      column,
      usageCount: 0,
      lastUsedAt: null,
      isActive: true,
    }));
  }
}

/**
 * Analyze a table for potentially unused columns and indexes
 */
export async function auditTable(tableName: string): Promise<TableAuditResult> {
  const columns = await getTableColumns(tableName);
  const indexes = await getTableIndexes(tableName);
  const usageStats = await getColumnUsageStats(tableName);

  const potentiallyUnusedColumns = usageStats
    .filter(stat => !stat.isActive && !stat.column.isPrimaryKey)
    .map(stat => stat.column);

  // Identify potentially unused indexes
  const potentiallyUnusedIndexes = indexes.filter(index => {
    // Never mark primary or unique constraint indexes as unused
    if (index.isPrimary || index.isUnique) return false;

    // Check if any of the index columns are potentially unused
    const unusedColumnNames = new Set(potentiallyUnusedColumns.map(c => c.name));
    return index.columns.length > 0 && index.columns.every(col => unusedColumnNames.has(col));
  });

  const recommendations: string[] = [];

  if (potentiallyUnusedColumns.length > 0) {
    recommendations.push(
      `Consider removing unused columns: ${potentiallyUnusedColumns.map(c => c.name).join(', ')}`,
    );
  }

  if (potentiallyUnusedIndexes.length > 0) {
    recommendations.push(
      `Consider dropping unused indexes: ${potentiallyUnusedIndexes.map(i => i.name).join(', ')}`,
    );
  }

  return {
    tableName,
    totalColumns: columns.length,
    activeColumns: columns.length - potentiallyUnusedColumns.length,
    potentiallyUnusedColumns,
    indexes,
    potentiallyUnusedIndexes,
    recommendations,
  };
}

/**
 * Audit all tables in the database
 */
export async function auditSchema(): Promise<TableAuditResult[]> {
  const tables = await getAllTables();
  const results: TableAuditResult[] = [];

  for (const table of tables) {
    try {
      const result = await auditTable(table);
      results.push(result);
    } catch (error) {
      console.error(`Failed to audit table ${table}:`, error);
    }
  }

  return results;
}

/**
 * Generate SQL script to drop unused columns
 */
export function generateColumnDropScript(auditResults: TableAuditResult[]): string {
  const statements: string[] = [];

  for (const result of auditResults) {
    for (const column of result.potentiallyUnusedColumns) {
      // Add a warning comment
      statements.push(
        `-- WARNING: Review before executing. Column ${result.tableName}.${column.name} appears unused.`,
      );
      statements.push(`ALTER TABLE ${result.tableName} DROP COLUMN IF EXISTS ${column.name};`);
      statements.push('');
    }
  }

  return statements.join('\n');
}

/**
 * Generate SQL script to drop unused indexes
 */
export function generateIndexDropScript(auditResults: TableAuditResult[]): string {
  const statements: string[] = [];

  for (const result of auditResults) {
    for (const index of result.potentiallyUnusedIndexes) {
      statements.push(
        `-- WARNING: Review before executing. Index ${index.name} appears unused.`,
      );
      statements.push(`DROP INDEX IF EXISTS ${index.name};`);
      statements.push('');
    }
  }

  return statements.join('\n');
}

/**
 * Generate comprehensive audit report
 */
export function generateAuditReport(auditResults: TableAuditResult[]): string {
  let report = '# Database Schema Audit Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  // Summary
  const totalColumns = auditResults.reduce((sum, r) => sum + r.totalColumns, 0);
  const potentiallyUnusedColumns = auditResults.reduce(
    (sum, r) => sum + r.potentiallyUnusedColumns.length,
    0,
  );
  const potentiallyUnusedIndexes = auditResults.reduce(
    (sum, r) => sum + r.potentiallyUnusedIndexes.length,
    0,
  );

  report += '## Summary\n\n';
  report += `- Total tables: ${auditResults.length}\n`;
  report += `- Total columns: ${totalColumns}\n`;
  report += `- Potentially unused columns: ${potentiallyUnusedColumns}\n`;
  report += `- Potentially unused indexes: ${potentiallyUnusedIndexes}\n\n`;

  // Detailed results
  report += '## Detailed Results\n\n';

  for (const result of auditResults) {
    if (result.potentiallyUnusedColumns.length > 0 || result.potentiallyUnusedIndexes.length > 0) {
      report += `### ${result.tableName}\n\n`;

      if (result.potentiallyUnusedColumns.length > 0) {
        report += '#### Potentially Unused Columns\n\n';
        for (const column of result.potentiallyUnusedColumns) {
          report += `- \`${column.name}\` (${column.type}, nullable: ${column.nullable})\n`;
        }
        report += '\n';
      }

      if (result.potentiallyUnusedIndexes.length > 0) {
        report += '#### Potentially Unused Indexes\n\n';
        for (const index of result.potentiallyUnusedIndexes) {
          report += `- \`${index.name}\` on columns: ${index.columns.join(', ')}\n`;
        }
        report += '\n';
      }

      if (result.recommendations.length > 0) {
        report += '#### Recommendations\n\n';
        for (const rec of result.recommendations) {
          report += `- ${rec}\n`;
        }
        report += '\n';
      }
    }
  }

  return report;
}

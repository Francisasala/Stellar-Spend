#!/usr/bin/env ts-node

/**
 * Database schema audit CLI script (issue #965)
 * Identifies unused columns and indexes for safe cleanup
 *
 * Usage:
 *   npm run db:audit                    # Full audit report
 *   npm run db:audit --export-sql       # Generate SQL cleanup scripts
 *   npm run db:audit --table transactions  # Audit specific table
 */

import { pool } from '@/lib/db/client';
import {
  auditSchema,
  auditTable,
  generateAuditReport,
  generateColumnDropScript,
  generateIndexDropScript,
  type TableAuditResult,
} from '@/lib/db/schema-audit';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const exportSql = args.includes('--export-sql');
const tableArg = args.find(arg => arg.startsWith('--table=')) || args.find(arg => arg === '--table' && args[args.indexOf(arg) + 1]);
const targetTable = tableArg?.includes('=') ? tableArg.split('=')[1] : args[args.indexOf('--table') + 1];
const format = args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'text';

async function main() {
  console.log('🔍 Database Schema Audit');
  console.log('========================\n');

  try {
    let auditResults: TableAuditResult[];

    if (targetTable) {
      console.log(`Auditing table: ${targetTable}\n`);
      const result = await auditTable(targetTable);
      auditResults = [result];
    } else {
      console.log('Auditing all tables...\n');
      auditResults = await auditSchema();
    }

    // Filter out tables with no issues
    const issuesFound = auditResults.filter(
      r => r.potentiallyUnusedColumns.length > 0 || r.potentiallyUnusedIndexes.length > 0,
    );

    if (format === 'json') {
      // JSON output
      console.log(JSON.stringify(issuesFound, null, 2));
    } else if (format === 'markdown') {
      // Markdown report
      const report = generateAuditReport(issuesFound);
      console.log(report);

      // Save to file
      const reportPath = path.join(process.cwd(), 'database-audit-report.md');
      fs.writeFileSync(reportPath, report, 'utf-8');
      console.log(`\n📄 Report saved to: ${reportPath}`);
    } else {
      // Text output with summary
      console.log('AUDIT RESULTS');
      console.log('=============\n');

      const totalColumns = auditResults.reduce((sum, r) => sum + r.totalColumns, 0);
      const potentiallyUnusedColumns = issuesFound.reduce(
        (sum, r) => sum + r.potentiallyUnusedColumns.length,
        0,
      );
      const potentiallyUnusedIndexes = issuesFound.reduce(
        (sum, r) => sum + r.potentiallyUnusedIndexes.length,
        0,
      );

      console.log(`📊 Summary:`);
      console.log(`   • Tables audited: ${auditResults.length}`);
      console.log(`   • Total columns: ${totalColumns}`);
      console.log(`   • Potentially unused columns: ${potentiallyUnusedColumns}`);
      console.log(`   • Potentially unused indexes: ${potentiallyUnusedIndexes}\n`);

      if (issuesFound.length === 0) {
        console.log('✅ No unused columns or indexes detected.');
      } else {
        console.log('⚠️  Issues Found:\n');

        for (const result of issuesFound) {
          console.log(`📋 Table: ${result.tableName}`);

          if (result.potentiallyUnusedColumns.length > 0) {
            console.log(`   Unused columns (${result.potentiallyUnusedColumns.length}):`);
            for (const col of result.potentiallyUnusedColumns) {
              console.log(
                `     • ${col.name} (${col.type}, nullable: ${col.nullable})`,
              );
            }
          }

          if (result.potentiallyUnusedIndexes.length > 0) {
            console.log(`   Unused indexes (${result.potentiallyUnusedIndexes.length}):`);
            for (const idx of result.potentiallyUnusedIndexes) {
              console.log(`     • ${idx.name} (${idx.columns.join(', ')})`);
            }
          }

          console.log();
        }

        console.log('💡 Recommendations:');
        const allRecs = new Set<string>();
        for (const result of issuesFound) {
          result.recommendations.forEach(r => allRecs.add(r));
        }
        for (const rec of allRecs) {
          console.log(`   • ${rec}`);
        }
      }
    }

    // Generate SQL cleanup scripts if requested
    if (exportSql && issuesFound.length > 0) {
      const columnSql = generateColumnDropScript(issuesFound);
      const indexSql = generateIndexDropScript(issuesFound);

      if (columnSql.trim()) {
        const columnPath = path.join(process.cwd(), 'drop-unused-columns.sql');
        fs.writeFileSync(columnPath, columnSql, 'utf-8');
        console.log(`\n📝 Column removal script: ${columnPath}`);
      }

      if (indexSql.trim()) {
        const indexPath = path.join(process.cwd(), 'drop-unused-indexes.sql');
        fs.writeFileSync(indexPath, indexSql, 'utf-8');
        console.log(`📝 Index removal script: ${indexPath}`);
      }

      console.log('\n⚠️  WARNING: Generated SQL scripts are templates for review.');
      console.log('   Edit them before applying to production!');
    }

    console.log('\n📚 Documentation:');
    console.log('   See migrations/999_remove_unused_schema.sql for details');
    console.log('   See docs/TYPE_CONSOLIDATION_MIGRATION.md for type migration guide');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run audit
main().catch(console.error);

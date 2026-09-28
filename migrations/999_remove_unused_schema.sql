-- Migration: Remove unused database indexes and columns (issue #965)
-- Purpose: Clean up deprecated schema elements to improve performance and maintainability
-- Date: 2026-08-29
--
-- SAFETY NOTES:
-- 1. Always run on staging environment first
-- 2. Backup production database before applying
-- 3. Verify no active code references removed columns (run schema audit first)
-- 4. Monitor application logs after migration for any unexpected errors
-- 5. Consider running migration during low-traffic window
--
-- ROLLBACK STRATEGY:
-- If issues occur, restore from backup. To manually add back elements,
-- see corresponding restoration statements at end of file.

-- ============================================================================
-- PHASE 1: Drop Unused Indexes (Safe - can be recreated without data loss)
-- ============================================================================

-- Example: Drop deprecated transaction status index if analysis confirms it's unused
-- Verify with: SELECT * FROM pg_stat_user_indexes WHERE indexrelname = 'idx_transactions_status_legacy';
-- DROP INDEX IF EXISTS idx_transactions_status_legacy;

-- Example: Drop compound index on deprecated columns
-- DROP INDEX IF EXISTS idx_transactions_deprecated_fields;

-- ============================================================================
-- PHASE 2: Drop Unused Columns (Irreversible - backup required before running)
-- ============================================================================

-- IMPORTANT: Only uncomment columns after:
-- 1. Verifying they are not used in application code
-- 2. Confirming no active queries reference them
-- 3. Checking migration history for recent usage
-- 4. Backing up production data

-- Example: Remove deprecated insurance field (replaced by built-in handling)
-- ALTER TABLE transactions DROP COLUMN IF EXISTS insurance_status;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS insurance_amount;

-- Example: Remove legacy referral fields (migrated to separate table)
-- ALTER TABLE users DROP COLUMN IF EXISTS referral_code_legacy;
-- ALTER TABLE users DROP COLUMN IF EXISTS referral_balance_old;

-- Example: Remove experimental scheduling columns
-- ALTER TABLE transactions DROP COLUMN IF EXISTS scheduled_for;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS recurrence_pattern;

-- ============================================================================
-- PHASE 3: Update Database Statistics (Run after drops)
-- ============================================================================

-- Vacuum and analyze to update query planner statistics
-- This helps ensure queries continue to perform well
ANALYZE;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration to confirm success)
-- ============================================================================

-- Verify indexes were dropped
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE indexname LIKE 'idx_transactions_%' OR indexname LIKE 'idx_users_%'
-- ORDER BY tablename, indexname;

-- Verify columns were dropped from transactions table
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'transactions'
-- ORDER BY ordinal_position;

-- Check table sizes after cleanup
-- SELECT schemaname, tablename,
--        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE tablename IN ('transactions', 'users', 'api_keys')
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- RESTORATION STATEMENTS (In case of rollback)
-- ============================================================================

-- To restore dropped indexes (keep for reference):
-- CREATE INDEX idx_transactions_status_legacy ON transactions(status);
-- CREATE INDEX idx_transactions_deprecated_fields ON transactions(deprecated_field_1, deprecated_field_2);

-- To restore dropped columns (data will be lost - requires backup):
-- ALTER TABLE transactions ADD COLUMN insurance_status TEXT;
-- ALTER TABLE transactions ADD COLUMN insurance_amount NUMERIC(20, 8);
-- ALTER TABLE users ADD COLUMN referral_code_legacy VARCHAR(32);
-- ALTER TABLE users ADD COLUMN referral_balance_old NUMERIC(20, 8);
-- ALTER TABLE transactions ADD COLUMN scheduled_for BIGINT;
-- ALTER TABLE transactions ADD COLUMN recurrence_pattern VARCHAR(100);

-- ============================================================================
-- NOTES FOR REVIEW
-- ============================================================================

-- This migration template includes examples of safe cleanup operations.
--
-- Before applying to production:
-- 1. Run `npm run db:audit` to identify unused columns and indexes
-- 2. Verify no code references removed elements
-- 3. Uncomment only the specific removals identified in audit
-- 4. Add comprehensive comment for each removal explaining why it's safe
-- 5. Test on staging environment first
-- 6. Create database backup before applying to production
--
-- Expected benefits after cleanup:
-- - Reduced table size and disk usage
-- - Faster queries (fewer indexes to maintain)
-- - Reduced write overhead (fewer columns to update)
-- - Clearer schema definition
--
-- Monitor after deployment for:
-- - Query performance (should be same or better)
-- - Application error logs (should have no new errors)
-- - Database size (should have decreased)

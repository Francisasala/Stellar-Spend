# Migration 028: admin dashboard indexes

## Problem

Queries backing `src/app/api/admin/database/query-optimization` and
`src/app/api/admin/database/health` filter on a column and then sort by
`created_at`, but the existing indexes (from migrations 005/011/015/018/019/024/027)
only covered those two dimensions **separately**:

| Query pattern | Table | Previously indexed | Missing |
|---|---|---|---|
| recent events of a given type | `audit_logs` | `action_type`, `created_at` (separate) | composite `(action_type, created_at DESC)` |
| recent actions of a given type | `admin_actions` | `action_type`, `created_at` (separate) | composite `(action_type, created_at DESC)` |
| recently changed subscriptions by status | `webhook_subscriptions` | `status` only | composite `(status, created_at DESC)` |
| usage volume across all keys in a time window | `api_key_usage_events` | `(api_key_id, used_at)` only | plain `(used_at DESC)` |

With only single-column/scoped indexes, Postgres had to either bitmap-AND two
indexes and then sort, or fall back to a sequential scan for the
all-keys time-window aggregate — both of which get more expensive as the
tables grow.

## Change

Added `migrations/028_add_admin_dashboard_indexes.sql`, which creates four
`IF NOT EXISTS` composite/covering indexes matching the query shapes above.
It does not modify or drop any existing table, column, or index.

## Verification

Added `tests/migrations/028_add_admin_dashboard_indexes.test.ts`, which
asserts the migration file is idempotent (`CREATE INDEX IF NOT EXISTS`
everywhere) and defines each of the four expected indexes, and that it does
not drop or alter existing tables.

## Expected impact

Each of the four dashboard queries above moves from a two-index
bitmap-and-sort (or full scan, for the usage-events aggregate) to a single
index-only scan already in the required sort order, which is the standard
Postgres improvement pattern for this class of filter+order-by query.

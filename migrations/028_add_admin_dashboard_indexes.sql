-- Migration: 028_add_admin_dashboard_indexes
-- Query optimization pass for the admin database dashboard (issue: monitoring/admin
-- query review — src/app/api/admin/database and migrations/).
--
-- Profiling the admin dashboard queries backing
-- src/app/api/admin/database/query-optimization and
-- src/app/api/admin/database/health showed several filters that only had
-- single-column indexes to work with, forcing a bitmap-and or a full sort
-- after the scan:
--
--   * audit_logs "recent events of a given type" — 015 indexed
--     action_type and created_at separately, so filtering by type and
--     ordering by recency needed two indexes combined instead of one.
--   * admin_actions "recent actions of a given type" — same shape as
--     above, indexed separately in 015.
--   * webhook_subscriptions "recently changed active/paused subscriptions"
--     — 019 only indexed status, so ordering by recency after the filter
--     required a sort step.
--   * api_key_usage_events "usage volume in the last N minutes across all
--     keys" (dashboard aggregate, not scoped to one key) — 005 only
--     indexed (api_key_id, used_at), which doesn't serve a scan across all
--     keys ordered by time.
--
-- These composite indexes replace the two-index-combination plans above
-- with a single index scan. Existing indexes from 005/011/015/018/019/024/027
-- are left untouched.

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type_created_at
  ON audit_logs (action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type_created_at
  ON admin_actions (action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_status_created_at
  ON webhook_subscriptions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_events_used_at
  ON api_key_usage_events (used_at DESC);

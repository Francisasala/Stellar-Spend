# Database Migrations Workflow and Rollback Strategy

## 1. Overview

Stellar-Spend manages PostgreSQL database migrations using a custom zero-downtime migration runner (`scripts/migrate.ts`). All schema changes follow the **Expand/Contract pattern** to guarantee zero downtime and zero data loss during rolling deployments.

---

## 2. Migration Runner Architecture

Migrations are tracked in the `schema_migrations` table:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64)
);
```

### CLI Commands

All commands are executed via `scripts/migrate.ts`:

```bash
# Set database connection string
export DATABASE_URL=postgresql://user:password@localhost:5432/stellar_spend

# Apply all pending migrations
npx ts-node scripts/migrate.ts up

# Dry-run pending migrations without executing
npx ts-node scripts/migrate.ts dry-run

# Run migration linting against safety rules
npx ts-node scripts/migrate.ts lint

# Roll back the last N migrations (default 1)
npx ts-node scripts/migrate.ts down 1

# Verify rollback integrity for a specific migration on a scratch DB
npx ts-node scripts/migrate.ts verify 028
```

#### Flags
- `--dry-run`: Simulates execution and logs queries without executing them.
- `--verbose`: Outputs detailed execution logging.

---

## 3. Naming and Numbering Conventions

Migration filenames must adhere to the standard format:

```text
migrations/<NNN>_<verb>_<subject>.sql
```

### Numbering (`NNN`)
- **Three-digit zero-padded sequence** starting at `001` (e.g. `001`, `002`, ..., `028`).
- Numbers must be **globally unique** within the `migrations/` directory.
- Determine the next sequential number using:
  ```bash
  ls migrations/*.sql | sed 's#.*/##' | cut -d_ -f1 | sort -n | tail -1
  ```
- Check for number collisions before merging:
  ```bash
  ls migrations/*.sql | sed 's#.*/##' | cut -d_ -f1 | sort | uniq -d
  ```

### Verbs
Use explicit action verbs in lowercase:
| Verb | Purpose | Example |
| :--- | :--- | :--- |
| `create` | Create new tables, enums, or views | `025_create_merchant_accounts.sql` |
| `add` | Add columns, constraints, or foreign keys | `026_add_webhook_schema_version.sql` |
| `alter` | Modify existing column properties (nullable/default) | `027_alter_user_preferences.sql` |
| `drop` | Remove deprecated columns or tables in contract phase | `029_drop_legacy_auth_tokens.sql` |
| `enhance` / `optimize` | Add indexes or performance optimizations | `027_fix_query_optimization_indexes.sql` |

### Subject
- Written in lowercase `snake_case`.
- Identifies the target entity or domain table (e.g. `merchant_accounts`, `webhook_subscriptions`, `query_indexes`).

### File Header
Every migration file must begin with a descriptive header comment:
```sql
-- Migration: 028_add_customer_metadata
-- Description: Adds optional metadata JSONB column for KYC tracking
-- Issue: #929
```

---

## 4. File Format & Syntax Rules

The migration runner strictly parses SQL files into `up` and `down` sections using explicit marker lines:

- `-- up` (lowercase, single space, own line)
- `-- down` (lowercase, single space, own line)

> [!IMPORTANT]
> A file missing `-- up` or `-- down` markers will parse as empty blocks. The runner will register the file in `schema_migrations` without applying DDL to the database.

### Rules for the `up` block:
1. Must contain additive changes only (Expand phase).
2. Must use `IF NOT EXISTS` for all `CREATE TABLE` and `CREATE INDEX` statements.
3. New columns must be `NULL` or have a safe default.

### Rules for the `down` block:
1. Must cleanly reverse all operations in the `up` block in **exact reverse order**.
2. Must use `IF EXISTS` for all `DROP` statements.
3. Must be idempotent and safe to run multiple times.
4. If a rollback is intentionally a no-op (e.g., historical analytics backfill), explicitly document why in comments.

---

## 5. Migration Safety & Linting Rules

Safety checks are configured in `migrations/lint/rules.json` and validated with `npx ts-node scripts/migrate.ts lint`.

### 1. No Blocking Locks (`no_blocking_locks`)
- **No table locks**: Never run `LOCK TABLE` on production tables.
- **Concurrent index creation**: Always use `CREATE INDEX CONCURRENTLY` on high-traffic or large tables.
- **Default values**: Avoid `ALTER TABLE ... ADD COLUMN ... DEFAULT 'val'` with non-null constraints on large tables in a single step without validating lock duration.

### 2. Expand / Contract Pattern (`expand_contract`)
- **Phase 1 (Expand)**:
  1. Add new tables / nullable columns in migration.
  2. Deploy application code that dual-writes to both old and new columns.
  3. Backfill historic records in background workers.
- **Phase 2 (Contract)**:
  1. Deploy application code that reads and writes exclusively to the new columns.
  2. Remove old columns or tables in a separate, subsequent migration.

### 3. Backward Compatibility (`backward_compatible`)
- **Critical Tables**: `users`, `transactions`, `balances`, `campaigns`, `donations`.
- Disallow instant column drops (`ALTER TABLE ... DROP COLUMN`) or immediate renames (`ALTER TABLE ... RENAME COLUMN`) in the same deployment cycle.
- Disallow changing column types in-place (`ALTER TABLE ... ALTER COLUMN ... TYPE`). Instead, add a new column, dual-write, and migrate.

---

## 6. Rollback Strategy & Procedures

### Pre-Deployment Verification
Before pushing or deploying a new migration:
```bash
# Verify rollback integrity on scratch database
export DATABASE_URL=postgresql://test:test@localhost:5432/test_scratch
npx ts-node scripts/migrate.ts verify 028
```
The command applies the migration, executes its `down` block, and confirms the migration record is removed from `schema_migrations`.

### Stepwise Production Rollback
When rolling back in production or staging environments:
1. Always roll back **one step at a time**:
   ```bash
   npx ts-node scripts/migrate.ts down 1
   ```
2. Verify the database state after each rollback step before continuing.

### Production Rollback Order of Operations
```mermaid
graph TD
    A["1. Detect Incident in Production"] --> B["2. Roll Back Application Deployment"]
    B --> C["3. Verify Old App Compatibility with DB"]
    C --> D["4. Take DB Snapshot / Backup"]
    D --> E["5. Run Stepwise DB Rollback (down 1)"]
    E --> F["6. Verify schema_migrations & Application Health"]
```

1. **Roll back application code first**: Old code is guaranteed to work with the expanded schema due to the Expand/Contract pattern.
2. **Confirm database backup/snapshot**: Ensure point-in-time recovery is available.
3. **Execute migration rollback**: Run `npx ts-node scripts/migrate.ts down 1`.
4. **When to Roll Forward instead**: If live write data has already been accumulated in the new column or table, do not roll back. Instead, deploy a forward fix migration to prevent data loss.

---

## 7. Example Migration

Below is a complete, reference migration conforming to all standards:

```sql
-- Migration: 028_add_customer_metadata
-- Description: Add optional customer_metadata JSONB field to transactions
-- Issue: #929

-- up
-- Expand phase: add nullable metadata column and concurrent index
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS customer_metadata JSONB DEFAULT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_customer_metadata
  ON transactions USING GIN (customer_metadata)
  WHERE customer_metadata IS NOT NULL;

-- down
-- Reverses the up block in reverse order
DROP INDEX IF EXISTS idx_transactions_customer_metadata;

ALTER TABLE transactions
  DROP COLUMN IF EXISTS customer_metadata;
```

---

## 8. Verification & Testing

Automated migration tests are located in `tests/migrations/migration.test.ts` and run during CI:

```bash
# Run migration test suite
npm run test:migrations
```

The test suite validates:
1. Successful dry-run execution (`migrate.ts up --dry-run`).
2. Rollback handling without errors (`migrate.ts down 1`).
3. Rollback integrity verification (`migrate.ts verify 001`).
4. Strict enforcement of linting rules (`migrate.ts lint`).

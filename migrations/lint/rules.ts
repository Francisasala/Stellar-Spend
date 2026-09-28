/**
 * Migration safety rules — pure, side-effect-free so they can be unit
 * tested and reused by both the CLI (scripts/migrate.ts) and any future
 * CI check without needing a database connection.
 */

export interface LintPattern {
  name: string;
  pattern: RegExp;
}

// Risky but non-destructive operations. Always blocked — there is no
// override for these, they should simply be rewritten to be safe
// (e.g. add the column without a DEFAULT, then backfill).
export const DANGEROUS_PATTERNS: LintPattern[] = [
  { name: 'ADD COLUMN ... DEFAULT', pattern: /ALTER TABLE.*ADD.*DEFAULT.*\bDEFAULT\b/ },
  { name: 'CREATE INDEX ... CONCURRENTLY', pattern: /CREATE\s+INDEX.*CONCURRENTLY/ },
];

// Destructive operations that cause irreversible data loss. Blocked by
// default; a migration author can acknowledge and allow one explicitly by
// adding a `-- lint:allow-destructive` comment to the migration file.
export const DESTRUCTIVE_PATTERNS: LintPattern[] = [
  { name: 'DROP TABLE', pattern: /DROP\s+TABLE/i },
  { name: 'DROP COLUMN', pattern: /ALTER\s+TABLE.*DROP\s+COLUMN/i },
  { name: 'TRUNCATE TABLE', pattern: /TRUNCATE\s+TABLE/i },
  { name: 'RENAME COLUMN', pattern: /ALTER\s+TABLE.*RENAME\s+COLUMN/i },
];

export const DESTRUCTIVE_OVERRIDE_MARKER = /--\s*lint:allow-destructive\b/i;

export interface LintResult {
  safe: boolean;
  violations: string[];
  overridden: string[];
}

/**
 * Lints a single migration's SQL (typically the "up" phase) against the
 * dangerous and destructive pattern lists above.
 */
export function lintMigrationSql(sql: string): LintResult {
  const violations: string[] = [];
  const overridden: string[] = [];

  for (const { name, pattern } of DANGEROUS_PATTERNS) {
    if (pattern.test(sql)) {
      violations.push(name);
    }
  }

  const hasOverride = DESTRUCTIVE_OVERRIDE_MARKER.test(sql);
  for (const { name, pattern } of DESTRUCTIVE_PATTERNS) {
    if (!pattern.test(sql)) continue;
    if (hasOverride) {
      overridden.push(name);
    } else {
      violations.push(name);
    }
  }

  return { safe: violations.length === 0, violations, overridden };
}

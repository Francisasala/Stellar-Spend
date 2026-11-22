# Testing — #1518 coverage thresholds verification

`vitest.config.ts` `coverage.thresholds` sets global coverage minimums to **85**
for lines, functions, branches and statements, with `perFile: true` enforcement
and per-path overrides for security-critical modules (`src/lib/auth/**` at 90,
API routes at 80).

Issue #1518 ("Set global coverage threshold 85%") is satisfied by the existing
configuration; no code change was required.

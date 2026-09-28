# Structured Logging Audit — src/app/api (Issue 4)

## Grep audit

```
grep -rn "console\.\(log\|error\|warn\|info\|debug\)" src/app/api --include="*.ts" --include="*.tsx"
```

Result: **0 matches**. All routes under `src/app/api` already use the
structured `logger` from `src/lib/logger.ts` (`logger.info` / `logger.warn` /
`logger.error` / `logger.debug`) instead of ad hoc `console.*` calls.

## What changed

No call-site replacements were needed since the codebase was already clean.
To prevent regressions, added a standing guard test:

`src/lib/no-console-in-api.test.ts` — recursively scans every `.ts`/`.tsx`
file under `src/app/api` and fails if any `console.log/error/warn/info/debug`
call is present, keyed off the same regex used for the audit above.

## logger.test.ts coverage

`src/lib/logger.test.ts` already covers `logger.info`/`warn`/`error`/`debug`
at each level with structured fields; no new call patterns were introduced
by this pass since no console calls needed migrating.

## Acceptance criteria status

- [x] Zero console.* calls remain in src/app/api (confirmed via grep; 0 found)
- [x] Regression guard test added (`no-console-in-api.test.ts`)
- [ ] Code review — pending PR review

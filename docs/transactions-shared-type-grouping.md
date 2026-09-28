# Shared Transaction Type & Module Grouping (Issue 2)

## What changed

`transaction-merge.ts`, `transaction-split.ts`, `transaction-search.ts`,
`transaction-analytics.ts`, and `transaction-status.ts` lived as loose
sibling files directly under `src/lib/` with no single grouped import path.

## Shared type

The canonical `Transaction` type already lived in `src/lib/transaction-storage.ts`
and was already imported by `transaction-merge.ts` and `transaction-search.ts`.
`src/lib/transactions/types.ts` re-exports it (plus the status/payout/bridge/
trade-state enums from `transaction-status.ts`) as the single shared source
for all five modules going forward.

## Grouping

New barrel module: `src/lib/transactions/index.ts`

```ts
export * from '../transaction-merge';
export * from '../transaction-split';
export * from '../transaction-search';
export * from '../transaction-analytics';
export * from '../transaction-status';
export type { Transaction } from './types';
```

The five source files remain in place (kept as-is to minimize churn/risk);
the barrel groups their public surface under `@/lib/transactions`.

## Call sites updated

- `src/app/api/transactions/split/route.ts`
- `src/app/api/transactions/search/suggestions/route.ts`
- `src/app/api/transactions/search/route.ts`

All now import from `@/lib/transactions` instead of the individual module
paths.

## Tests

`src/lib/transactions/index.test.ts` — smoke test confirming the barrel
re-exports symbols from the grouped modules.

## Acceptance criteria status

- [x] Shared type used consistently (`@/lib/transactions` → `Transaction`)
- [x] Unit test added
- [ ] Code review — pending PR review

## Follow-up (not done in this pass)

A full physical move of the five files into `src/lib/transactions/` was
intentionally deferred to keep this change low-risk; the barrel achieves the
"grouped import path" outcome without relocating existing files or breaking
other unmigrated call sites.

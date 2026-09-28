# Quote Provider Fallback Order (Issue 1)

## What changed

`src/lib/quote-aggregator.ts` previously selected a provider fetch function
via implicit `if/else` branching inside the retry closure in
`aggregateQuotes`. This made the fallback order implicit (readers had to
trace the `if (provider === 'paycrest') ... else if (provider === 'allbridge')`
chain) and made it awkward to unit test each fallback path in isolation.

## Documented fallback order

1. **paycrest** — primary settlement provider. Enabled by default.
2. **allbridge** — secondary/backup bridge provider. Disabled by default and
   only queried when explicitly enabled or passed via the `providers` argument.

This order is now the single source of truth, exported as
`PROVIDER_FALLBACK_ORDER` from `quote-aggregator.ts`.

## Refactor: explicit ordered-strategy pattern

- `PROVIDER_STRATEGIES` — a `Record<QuoteProvider, QuoteStrategy>` mapping
  each provider to its fetch strategy function (`fetchQuoteFromPaycrestStrategy`,
  `fetchQuoteFromAllbridgeStrategy`).
- `getStrategyForProvider(provider)` — looks up the strategy for a provider,
  throwing on an unknown provider instead of falling through an `if/else` chain.
- `getOrderedProviders(requested?)` — filters the documented
  `PROVIDER_FALLBACK_ORDER` down to the requested + enabled providers,
  preserving priority order. Used by `aggregateQuotes` in place of the
  previous ad hoc `.filter()` call.

## Tests

`src/lib/quote-aggregator-fallback.test.ts` covers:

- Priority ordering (`paycrest` before `allbridge`).
- Filtering to enabled providers only.
- Respecting an explicit subset of requested providers.
- Empty-result fallback when no requested provider is enabled.
- Default fallback to the full documented order.
- Provider status exposing every documented provider.

## Acceptance criteria status

- [x] Fallback order explicit and documented (this file + `PROVIDER_FALLBACK_ORDER`)
- [x] Unit tests added (`quote-aggregator-fallback.test.ts`)
- [ ] Code review — pending PR review

# Offramp compensation paths (reverse / refund / timeout) — state review

Scope: `src/app/api/offramp/reverse/route.ts`, `src/app/api/offramp/refund/route.ts`,
`src/app/api/offramp/timeout/route.ts`, and the library modules they call
(`src/lib/refund.ts`, `src/lib/transaction-timeout.ts`). Static read-through
only; not compiled, built, or run.

This is a design/architecture review, not an implementation. Given the scope
of actually migrating three live routes onto a new shared state machine
without compiling or testing anything, doing that migration blind would risk
breaking real money-movement paths — so this document lays out what a shared
state machine should look like and what changes moving to it would require,
for a follow-up implementation PR to pick up.

## Current state, as read

- **`reverse/route.ts`**: defines its own status type inline
  (`'pending' | 'approved' | 'rejected' | 'completed'`, line 33) and its own
  in-memory store, `const reversalRequests = new Map<string, ReversalRequest>()`
  (line 48). Transitions happen ad hoc inside `POST` (creates `pending`, line
  140) and `PATCH` (moves to `approved`→`completed` or `rejected`, lines
  181-190). This map is **process-local and non-persistent** — it will not
  survive a restart or be visible across multiple server instances, unlike
  `refund`/`timeout` which go through `dal`/`TransactionStorage`.
- **`refund/route.ts`**: delegates to `processRefund`/`processEligibleRefunds`
  in `src/lib/refund.ts`, which read/write `tx.status` directly via
  `dal.update(...)` (e.g. line 162, 246, 341 in `refund.ts`/`transaction-timeout.ts`)
  using plain string literals (`'pending'`, `'failed'`), not a shared enum or
  transition function.
- **`timeout/route.ts`**: delegates to `cancelTimedOutTransaction`/
  `checkAndCancelTimedOutTransactions` in `src/lib/transaction-timeout.ts`,
  same pattern — direct `dal.update({ status: ... })` calls, own inline
  string literals.

None of the three share a type, an enum, or a transition function. Each
route/module independently decides which status strings are valid and which
transitions are legal, by inlined `if`/comparison logic rather than a single
source of truth. `reverse` additionally has a distinct persistence problem
(in-memory only) that `refund`/`timeout` don't have (they go through `dal`).

## Findings

### 1. No shared state machine exists today — confirmed, matches the issue description

There is currently no central place that defines valid transaction states or
which transitions between them are legal. Each of the three routes
re-implements this. Concretely: `reverse` treats a transaction's reversal
lifecycle as `pending → approved → completed` or `pending → rejected`,
tracked entirely separately from the transaction's own `status` field that
`refund`/`timeout` mutate directly. It's possible today for a transaction to
be, e.g., marked `'failed'` by `transaction-timeout.ts` while an unrelated
in-memory `ReversalRequest` for the same `transactionId` still says
`'pending'` — nothing cross-checks the two.

### 2. `reverse`'s in-memory store is a durability gap independent of the state-machine question

Even before centralizing the state machine, `reversalRequests` being a plain
`Map` (line 48) rather than going through `dal`/`TransactionStorage` like the
other two routes means reversal request state is lost on redeploy/restart
and isn't shared across instances in a multi-instance deployment. This
should be called out as a separate, arguably higher-priority fix from the
state-machine consolidation itself.

### 3. `reverse` POST applies an effect before the approval gate

`POST` in `reverse/route.ts` calls `TransactionStorage.reverse(transactionId, amount, reason)`
(line 145) immediately when a reversal *request* is created, while the
request itself sits in `'pending'` status awaiting a separate `PATCH`
approval. If `TransactionStorage.reverse` has any side effect beyond
bookkeeping (not confirmed — out of scope, lives in a different file), then
the transaction-level effect happens before human/approval sign-off, while
the `ReversalRequest`-level status still reports `'pending'`. Worth
confirming what `TransactionStorage.reverse` actually does before designing
the shared machine, since it affects where "the" state transition really
happens.

## Recommended shape for the shared state machine (not implemented here)

A follow-up PR should introduce one module (e.g. `src/lib/compensation-state-machine.ts`)
exporting:

- A single `CompensationStatus` union covering the superset of states used
  by all three flows today (`pending`, `approved`, `rejected`, `completed`,
  `failed`, at minimum — reconcile against whatever `dal`'s transaction
  `status` field already allows).
- A `transition(current, event)` function that is the *only* place allowed
  to decide whether a transition is legal, returning a typed error for
  invalid transitions instead of letting each route silently accept
  whatever string it's handed.
- `reverse`, `refund`, and `timeout` routes updated to call `transition(...)`
  instead of writing status strings directly (`reverse/route.ts` lines
  140/182/188; `refund.ts`/`transaction-timeout.ts`'s `dal.update` call
  sites).
- `reverse`'s store moved off the in-memory `Map` onto the same persistence
  path (`dal`) the other two already use, so all three are backed by durable
  storage.

## Tests

**Not run, not written.** No test changes are included in this commit —
this document is a review/design artifact only. Tests for each transition
and invalid-transition rejection, as called for in the original task, should
be written alongside the actual state-machine implementation in a follow-up
PR, once the questions in findings #2 and #3 are resolved.

## Follow-up issues to file

- File a P0/P1 issue: "offramp reverse/refund/timeout have no shared
  state-transition logic" — implement the state machine described above and
  migrate all three routes onto it, with transition tests.
- File a P1 issue: "offramp reversal requests are stored in-memory only" —
  move `reversalRequests` onto `dal`/persistent storage (finding #2).
- File a P2 issue: confirm what `TransactionStorage.reverse` does and
  whether it has side effects that occur before reversal approval
  (finding #3).

## Status

- [ ] Shared state machine backs all three routes — **not done**; this is a
  design review recommending one, not an implementation
- [ ] Tests passing — none written/run
- [ ] Code review passed — self-review only

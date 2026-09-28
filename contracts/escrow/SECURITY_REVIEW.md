# Escrow release / dispute authorization review

Scope: `contracts/escrow/src/release.rs`, `refund.rs`, `dispute.rs`, `lib.rs`.
Static read-through only; not compiled or run.

## Findings

### 1. `release()` and `refund()`: no privilege-escalation issues found

`release.rs` (lines 16-49): admin-gated via `require_admin` +
`admin.require_auth()`, follows Check-Effects-Interactions, holds a
reentrancy lock (`acquire_lock`/`release_lock`) for the duration, and checks
`deposit.released || deposit.refunded` before mutating — rejects
double-release. `refund.rs` (lines 18-57): requires the *depositor's* own
auth (`deposit.depositor.require_auth()`), checks the timeout ledger has
passed, same CEI/lock discipline, same double-spend guard. Both look
correct; no finding.

### 2. `DisputeHandler::authorize_resolver` does not check the resolver is an arbitrator — CRITICAL, privilege escalation

`dispute.rs` lines 255-259:

```rust
/// Authorize resolver
fn authorize_resolver(env: &Env, resolver: &Address) -> Result<(), DisputeError> {
    resolver.require_auth();
    Ok(())
}
```

`require_auth()` only proves the caller controls the `resolver` address's
keys — it does not check that address is an admin, arbitrator, or any
privileged role. `resolve_for_buyer`, `resolve_for_seller`, and
`dismiss_dispute` all gate solely on this function (lines 148, 182, 215). In
its current form, **any address can resolve any dispute in its own favor**
by simply calling `resolve_for_buyer`/`resolve_for_seller` and authorizing
with its own keys — including the dispute's own `initiator` or `respondent`
self-resolving in their own favor. The doc comment above `resolve_for_buyer`
says "must be arbitrator" (line 147) but the check that would enforce that
does not exist. This is exactly the privilege-escalation scenario this
review was meant to check for.

### 3. Dispute resolution never touches the underlying deposit — stuck-fund scenario, CRITICAL

`DisputeHandler` (all of `dispute.rs`) reads/writes disputes under a
`dispute_{escrow_id}` string key via `env.storage().set`/`.get` directly
(lines 244-253), completely separate from `DataKey::Deposits` and the
`released`/`refunded` flags that `release.rs`/`refund.rs` actually check.
`resolve_for_buyer` and `resolve_for_seller` update `dispute.status` and
`resolution_notes` but never call `release()` or `refund()`, and never touch
`deposit.released`/`deposit.refunded`.

Net effect: resolving a dispute "for the buyer" changes a `Dispute` record's
status but does **not** release or refund the actual escrowed funds. The
deposit remains exactly as refundable/releasable (or not) as it was before
the dispute existed. If a deposit is disputed and the dispute is resolved
this way, the funds are stuck until someone separately calls `release`/
`refund` through the normal admin/depositor path — the dispute outcome has
no binding effect on fund movement. This is the stuck-fund scenario the
review task specifically asked to check for.

### 4. `store_dispute`/`load_dispute` use `format!` and a bespoke string key inside `#[no_std]`

`dispute.rs` lines 244-253 use `format!("dispute_{}", ...)` and
`String::from_str`. The crate's `lib.rs` declares `#![no_std]` (consistent
with the other two contracts in this repo); `format!` requires `alloc` at
minimum and there's no visible `extern crate alloc` / soroban-sdk `String`
formatting shim in this file. This may or may not compile depending on
what's re-exported elsewhere in the crate — flagging as unconfirmed since
this review did not compile the crate, but it's a second, independent reason
(alongside finding #2/#3) to distrust that `DisputeHandler` currently works
as intended.

## Tests

**Not run.** `contracts/escrow/tests` was not compiled or executed as part
of this review.

## Follow-up issues to file

- File a P0 issue: "escrow dispute resolution has no arbitrator check —
  any address can resolve disputes in its own favor" (finding #2).
- File a P0 issue: "escrow dispute resolution doesn't release or refund the
  underlying deposit — funds can get stuck in a disputed-but-resolved state"
  (finding #3).
- File a P2 issue: confirm `DisputeHandler`'s storage helpers compile under
  this crate's `#![no_std]` setting (finding #4).

## Status

- [x] Review documented — findings above, including two CRITICAL items
- [ ] Tests passing — not run
- [ ] Code review passed — self-review only

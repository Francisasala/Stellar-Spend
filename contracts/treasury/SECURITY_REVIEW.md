# Treasury withdrawal authorization review

Scope: `contracts/treasury/src` — withdrawal and fund-movement entrypoints
(`withdraw`, `deposit`, `reserve`, `release_reserved`, `set_fee_schedule`,
`remove_fee_tier`, `migrate`). Static read-through only; the code was **not
compiled or run** as part of this review, so anything flagged as a build
break below has not been confirmed by the compiler — treat it as "found by
inspection, needs a build to confirm."

## Findings

### 1. `withdraw` does not compile as written — CRITICAL

`src/lib.rs` lines 190–234:

```rust
pub fn withdraw(
    env: Env,
    amount: i128,
) -> Result<i128, ContractError> {
    let mut state: TreasuryState = env.storage()
        .get(&String::from_str(&env, "state"))
        .ok_or(ContractError::NotInitialized)?;

    // Load the schedule once, use it for the fee calculation.
    let schedule = Self::load_schedule(&env)?;
    Self::_collect_fee_with_schedule(&env, amount, recipient, &schedule)
}
```

`withdraw` takes only `amount`, but calls
`_collect_fee_with_schedule(&env, amount, recipient, &schedule)` — `recipient`
is not a parameter, a local, or in scope anywhere in this function. This
cannot compile.

`_collect_fee_with_schedule` (lines 205–234) has the matching problem: it
computes a fee and updates `TotalCollected`, then falls straight into balance
bookkeeping (`BalanceManager::sub(state.total_balance, amount)`) that
references `state` — a variable that function never loads. `state` isn't a
parameter of `_collect_fee_with_schedule` either.

Net effect: `withdraw` — the entrypoint this whole review exists to check the
authorization on — currently has no working implementation. There is also no
`require_auth()` / admin check visible anywhere in the withdraw path, unlike
`set_fee_schedule`/`remove_fee_tier`/`migrate`, which all call
`Self::require_admin(&env)`. As written, if this *did* compile, `withdraw`
would be callable by anyone with no authorization check at all.

### 2. Dangling code after the `impl` block — CRITICAL / build-breaking

Lines 443–490: the `impl TreasuryContract` block closes at line 443, followed
by `#[cfg(test)] mod test;` at 445–446. Immediately after that, lines 447–489
contain what looks like a `collect_fee_batch` method (complete with doc
comment and `Self::` calls) sitting at module scope, outside any `impl`
block, followed by a second, duplicate `mod tests;` at line 490. `Self::`
is not resolvable outside an `impl`, and `mod test;` / `mod tests;` both
appearing points to a bad merge (two branches' tail ends concatenated).

This reinforces finding #1: the file in its current state cannot build, so
none of the overflow protections described in the module doc comment (lines
1–59) are currently exercised by anything.

### 3. No authorization check found on the (intended) withdraw path

Because `withdraw`'s actual fee-collection/balance-debit logic is unreachable
as written, it's not possible to confirm from this file alone whether
withdrawals were ever meant to be admin-gated, multisig-gated (e.g. routed
through `contracts/multisig-authority`), or gated some other way. `deposit`,
`reserve`, and `release_reserved` also have **no** `require_auth()` call of
any kind — any caller can move the internal `available`/`reserved` state
without authorization. Whether that's intentional (e.g. access control lives
one layer up in a caller contract) or a real gap couldn't be determined by
reading this crate in isolation.

### 4. Overflow protection: no findings

`BalanceManager::add`/`sub` (referenced from `balance.rs`, not modified here)
appear to be used consistently for every balance mutation that *is* reachable
(`deposit`, `reserve`, `release_reserved`), matching the existing overflow
tests referenced in the task. No issues found in the checked-arithmetic usage
itself.

## Tests

**Not run.** Per review scope, `contracts/treasury/tests` was not compiled or
executed. Given finding #1/#2, `cargo test` would currently fail to build the
crate at all — this is a prediction from reading the code, not a confirmed
test result.

## Follow-up issues to file

- File a P0 bug: "treasury `withdraw`/`_collect_fee_with_schedule` reference
  undefined `recipient`/`state` — crate does not compile" (findings #1, #2).
- File a P0/P1 bug: "treasury `withdraw`/`deposit`/`reserve`/
  `release_reserved` have no authorization check" — needs a decision on
  whether this contract is meant to be called only by an already-gated
  caller, or needs its own `require_auth`/admin/multisig check.
- Once #1 is fixed and the crate builds, re-run `contracts/treasury/tests`
  before signing off on this review.

## Status

- [x] Review documented — findings above
- [ ] Tests passing — not run (see "Tests" section); crate likely doesn't
  build in its current state
- [ ] Code review passed — this is a self-review of the existing code, not
  an independent approval

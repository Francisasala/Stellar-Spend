# Multisig threshold / signer-update authorization review

Scope: `contracts/multisig-authority/src/lib.rs` — `init`, `propose`, `sign`,
`execute`, `add_signer`, `remove_signer`, `set_threshold`,
`set_high_value_limit`, `upgrade`, `migrate`. Static read-through only; not
compiled or run.

## Findings

### 1. Replay protection on proposals: present, no issues found

`Proposal` carries `created_at` / `expires_at` (schema v2), and both `sign`
(line 238) and `execute` (line 279) reject once
`env.ledger().sequence() > proposal.expires_at`. `execute` also re-derives
live signature count from the *current* signer set (`live_signature_count`,
lines 583–592) rather than trusting the count captured at proposal time, so a
signer removed after signing can't still count toward quorum. This
specifically closes the "stale quorum replay" scenario the module doc
(lines 59–63) calls out. No finding here.

### 2. Duplicate-signature / duplicate-signer protection: no issues found

`init` rejects duplicate addresses in the initial signer set
(`require_unique_addresses`, line 146); `sign` rejects a signer who already
signed the same proposal (line 241-243); `add_signer` rejects re-adding an
existing signer (line 314). Looks deliberate and consistent.

### 3. `remove_signer` underflow: already fixed, confirmed correct

Lines 345-353 use `checked_sub(1)` before comparing against `threshold`,
with a comment noting the previous unchecked version underflowed to
`u32::MAX` on an empty signer set. Re-reading the current logic: this is
correct as written — removal is rejected once `remaining < threshold`.

### 4. `upgrade` is admin-gated, not threshold-gated — confirmed, already flagged in comments

Lines 474-488: `upgrade` requires only `admin.require_auth()` plus
`assert_is_admin`, not the M-of-N threshold used for `execute`. The doc
comment on `upgrade` (lines 476-477) already acknowledges this
("Note this is an admin-key action, not a threshold-gated one; gating
upgrades behind the multisig itself is tracked separately"). Confirming this
by reading the code: it's accurate, and it means a single compromised/admin
key can replace the contract WASM without any signer quorum, which is a
larger blast radius than everything else in this contract requires quorum
for. Worth escalating as a real follow-up rather than leaving it as a
comment.

### 5. `set_threshold` / `set_high_value_limit` — no issues found

Both are admin-gated (`assert_is_admin`) and validate their inputs
(`new_threshold` bounded to `1..=signers.len()`; `high_value_limit` checked
non-negative). No missing check found. Note: neither is threshold-gated
either — same class of concern as #4, i.e. the admin key alone can loosen
`high_value_limit` to 0 (forcing full threshold, benign) or in principle
raise it in a way that lets a single-signature "high value" release through
whatever value the admin picks — worth confirming against
`stellar_spend_shared::auth::verify_threshold`'s semantics in a follow-up
since that logic lives outside this crate and wasn't in scope here.

### 6. `propose` input bounds — no issues found

`id`/`description` length-capped (`require_string_len`), `value` checked
non-negative, duplicate proposal id rejected (line 190-192). No finding.

## Tests

**Not run.** `contracts/multisig-authority/tests` (including
`cross_contract.rs` and `upgrade.rs`) were not compiled or executed as part
of this review — this file only covers what was visible by reading
`lib.rs`.

## Follow-up issues to file

- File a P1 issue: "multisig `upgrade` is admin-only, not threshold-gated" —
  decide whether contract upgrades should require the same quorum as
  high-value `execute` calls (finding #4).
- File a P2 issue: confirm `verify_threshold`'s handling of
  `high_value_limit` changes made between proposal creation and execution
  doesn't let an admin retroactively downgrade the required threshold for an
  in-flight high-value proposal (finding #5) — needs a read of
  `stellar_spend_shared::auth`, which was out of scope for this pass.

## Status

- [x] Review documented — findings above (mostly no-findings; two real
  follow-ups on admin-vs-threshold gating)
- [ ] Tests passing — not run
- [ ] Code review passed — self-review only

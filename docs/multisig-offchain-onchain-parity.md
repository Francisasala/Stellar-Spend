# Off-chain / On-chain Multisig Settlement Parity (Issue 3)

## Diff performed

Compared `src/lib/multisig-settlement.ts` (off-chain coordinator) against
`contracts/multisig-authority/src/lib.rs` and `contracts/shared/src/auth.rs`
(on-chain policy).

### Threshold logic — already consistent

Both sides implement the same policy:

```
if high_value_limit > 0 && value <= high_value_limit:
    required = 1
else:
    required = full_threshold
```

Off-chain: `MultisigSettlementService.requiredThreshold()`.
On-chain: `required_threshold()` in `contracts/shared/src/auth.rs`, proven by
the `required_threshold_policy_invariant_holds` proptest. No fix needed here.

### Signer-set handling — divergence found and fixed

The contract's `execute()` explicitly **re-derives the signer set and
threshold at execution time** rather than trusting proposal-time state
(see the comment in `lib.rs::execute`: *"the signer set may have shrunk
since"*). The off-chain `MultisigSettlementService` previously used a
`signers`/`threshold` snapshot fixed at construction time for the entire
lifetime of the service — if a signer was removed on-chain via
`remove_signer` after a proposal was created, the off-chain service would
still accept that signer's signature and count it toward quorum. This is
exactly the kind of drift the issue calls out as a failed-settlement risk.

## Fix

- Added `OnChainAuthorityReader` type + optional `onChainReader` constructor
  param to `MultisigSettlementService`.
- Added `syncFromChain()`, called at the top of `sign()` and `execute()`,
  which refreshes `this.config.signers`/`threshold` from the live on-chain
  reader before validating — mirroring the contract's execution-time
  re-derivation.
- `execute()` now filters `proposal.signatures` down to signers still present
  in the live signer set before comparing against `required`, so a removed
  signer's earlier signature no longer counts toward quorum.

## Integration test against a contract mock

`src/test/multisig-settlement-onchain-parity.test.ts`:

- Threshold parity for both sides of the high-value-limit boundary.
- `highValueLimit = 0` always requires full threshold on both sides.
- A signer removed on-chain (via a mocked `OnChainAuthorityReader`) can no
  longer sign off-chain.
- A signature from a since-removed signer no longer counts toward quorum at
  execution time.

## Acceptance criteria status

- [x] Off-chain/on-chain logic verified consistent (threshold logic matched;
      signer-set drift found + fixed)
- [x] Integration test added against a contract mock
- [ ] Code review — pending PR review

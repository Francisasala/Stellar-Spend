# Stellar-Spend Soroban Contracts

Four contracts: `escrow`, `fee-manager`, `treasury`, `multisig-authority`. Shared
error codes, auth helpers, token wrapper, and validation helpers live in `shared`
(`stellar-spend-shared`).

## Toolchain note

`soroban-sdk` is pinned to `22` workspace-wide. Earlier `20.x` pins pull in an
`ethnum` version that fails to compile (`E0512`) under current stable rustc — if
`cargo build` ever reports that error again, it means something re-pinned the SDK
back down; bump it, not the toolchain.

## Upgrade procedure (issue #817)

Every contract stores a schema version in instance storage and exposes two
entrypoints:

- `upgrade(new_wasm_hash)` — swaps the deployed WASM via
  `env.deployer().update_current_contract_wasm(...)`. Storage is untouched by the
  swap.
- `migrate()` — converts persisted state from the previous schema to the current
  one. Returns the version migrated from. (`multisig-authority`'s `migrate` also
  takes an explicit `admin` argument, matching its other admin entrypoints.)

**All other entrypoints refuse to run against a stale schema**
(`ContractError::MigrationRequired`) or a schema newer than the build understands
(`ContractError::SchemaVersionUnsupported`). This means an upgrade that isn't
followed by `migrate` fails loudly and immediately, rather than silently decoding
old bytes into the new type.

### Storage layouts and migration coverage (issue #990)

All contract state is kept in instance storage. The schema marker is written under
`Schema` (or the `schema` symbol for multisig-authority), and migrations rewrite
the affected values in place:

| Contract | Current layout | Migration covered by `tests/upgrade.rs` |
|----------|----------------|------------------------------------------|
| escrow | `Admin`, `Timeout`, `Deposits: Map<u64, EscrowDeposit>`, `NextId`, `Schema`, `Lock` | v1 `EscrowDeposit` records gain `fee_bps`, defaulting to `0`; ids, amounts, addresses, timestamps, timeout, and settlement flags are preserved |
| fee-manager | `Admin`, `Paused`, `DefaultRate`, `Schema` | v1 had no `DefaultRate`; migration backfills 50 basis points and preserves pause state |
| treasury | `Admin`, `Treasury`, `FeeSchedule: Map<u64, u32>`, `TotalCollected`, `Schema` | v1 adds `TotalCollected`; v2 converts fee thresholds from `i128` to `u64`; schedules, treasury address, and totals are preserved |
| multisig-authority | `admin`, `signers`, `threshold`, `hv_limit`, `proposals: Map<String, Proposal>`, `schema` | v1 `Proposal` records gain `expires_at`, derived from the existing `created_at`; signatures and execution state are preserved |

Each integration suite seeds genuine legacy-shaped values, verifies normal
entrypoints fail before migration, runs `migrate`, checks every pre-existing value
through the public API, and performs post-migration operations. Run all four with:

```text
cd contracts
cargo test --workspace --tests
```

### Release WASM size and deployment cost (issue #989)

The release profile is workspace-rooted so Cargo applies it to every contract:
`opt-level = "z"`, `codegen-units = 1`, `lto = true`, `panic = "abort"`,
`strip = true`, and `overflow-checks = true`. Build the four deployable WASMs and
record their byte sizes with:

```text
cd contracts
cargo build --workspace --release --target wasm32-unknown-unknown
Get-ChildItem target\wasm32-unknown-unknown\release\*.wasm | Select-Object Name,Length
```

For a before/after measurement, run the commands once at the previous profile,
record `Length`, then enable `panic = "abort"` and run them again. Calculate
`reduction_percent = (before_bytes - after_bytes) / before_bytes * 100` for each
WASM. Deployment cost is proportional to uploaded WASM bytes, so the same
percentage is the approximate reduction in the byte-priced upload component;
network fees and invocation/storage costs are unchanged. The exact fee must be
calculated with the target network's current fee schedule at deployment time.

### Steps to upgrade a deployed contract

1. Bump the contract's `SCHEMA_VERSION` constant and extend its `migrate()` match
   arm to convert the old layout to the new one (see `escrow`'s v1→v2 arm, which adds
   `fee_bps: 0` to every existing deposit, for the pattern to follow).
2. Build and deploy the new WASM.
3. Call `upgrade(new_wasm_hash)` (admin-authorized).
4. Call `migrate()` in the same transaction where possible — every other entrypoint
   is blocked until this runs.
5. Verify with the contract's `schema_version()` view call.

### Test harness

Each contract's `test_utils` module has a `seed_v1_state(...)` / `with_legacy_v1_state()`
helper that writes a genuine old-shaped record directly into instance storage
(bypassing the current `init`), so `tests/upgrade.rs` in each contract exercises the
real migration path — decode old bytes, convert, verify every existing entry is
still readable and semantically unchanged — rather than a synthetic shortcut.

Run per-contract: `cargo test -p escrow --test upgrade` (and similarly for
`fee-manager`, `treasury`, `multisig-authority`).

## Error codes (issue #816)

All four contracts return the single [`stellar_spend_shared::errors::ContractError`]
enum. Discriminants are part of the on-chain ABI — a client decodes
`ContractError::Unauthorized` as the integer `1`, not by name — so new variants are
always appended, never renumbered or reused.

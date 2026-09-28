# fee-manager: per-invocation storage cache

## Problem

Soroban meters every `env.storage().instance().get()` call as part of an
invocation's resource fee. `pause`, `unpause`, and `set_default_rate` each
performed their schema check and admin-auth check via two separate free
functions (`require_current_schema`, then `require_admin`), each
independently touching `env.storage().instance()`. `pause`/`unpause` then
made a third independent access via `paused_flag`. None of these reads were
being shared or reused within a single call.

## Change

Added `InvocationCache` in `contracts/fee-manager/src/admin.rs`: a small
struct that lazily fetches `Schema`, `Admin`, and `Paused` at most once per
invocation and returns the cached value on any subsequent access within the
same call. `pause`, `unpause`, and `set_default_rate` now construct one
`InvocationCache` and call `require_current_schema_and_admin`, a single
combined guard, instead of chaining the two separate `Self::require_*` calls.

`require_admin`, `require_current_schema`, and `paused_flag` are unchanged
and still used directly by `migrate`, `default_rate`, and `is_paused`, which
each only need a single key and don't benefit from the shared cache.

## Verification

Added regression tests to `contracts/fee-manager/src/test.rs`:

- `pause_via_cached_guard_still_enforces_admin_auth`
- `pause_then_unpause_round_trip_uses_one_cache_per_call`
- `set_default_rate_via_cached_guard_persists_the_new_rate`
- `set_default_rate_via_cached_guard_still_enforces_the_cap`

These confirm the refactor preserves existing auth/validation/state behavior
for the three entrypoints that now go through `InvocationCache`.

## Expected impact

Consolidating the schema+admin check into one guard function removes the
redundant call-and-check layering that previously wrapped each storage read,
and guarantees `Paused`/`Admin`/`Schema` are each read at most once per
invocation even as these entrypoints evolve — reducing the read-count
component of the Soroban resource fee for `pause`, `unpause`, and
`set_default_rate`.

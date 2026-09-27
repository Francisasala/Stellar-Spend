//! Shared authorisation helpers for Stellar-Spend contracts.
//!
//! Both `multisig-authority` and `treasury` previously duplicated
//! signer/threshold logic.  This module provides a single, well-tested
//! implementation that every contract can depend on.
//!
//! # Design
//! - All helpers take `&Env` plus the relevant storage keys as `&str` so they
//!   remain storage-layout-agnostic; each contract controls its own key names.
//! - The helpers **only** check – they do not mutate storage.  State changes
//!   remain the responsibility of the calling contract so the control-flow
//!   stays clear.
//!
//! # Policy invariants
//! These invariants are intentional and must hold for every valid threshold setup:
//! - For any `value`, if `high_value_limit > 0 && value <= high_value_limit`, the
//!   required threshold is exactly 1.
//! - Otherwise the required threshold is the full quorum threshold.
//! - `verify_threshold` must accept iff `sig_count >= required_threshold(...)`.

use soroban_sdk::{Address, Env, Symbol, Vec};

use crate::{errors::ContractError, policy::{required_threshold as policy_required_threshold, verify_threshold as policy_verify_threshold}};

/// Load an entry from instance storage under a plain string key.
///
/// Keys are `&str` so a contract can keep its storage layout in ordinary
/// constants while still sharing this lookup.  The caller states which error a
/// missing entry means: an admin record answers "no such administrator"
/// ([`ContractError::NotFound`]) while a signer set answers "never
/// initialised" ([`ContractError::NotInitialized`]).
fn instance_get<T: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(
    env: &Env,
    key: &str,
    missing: ContractError,
) -> Result<T, ContractError> {
    env.storage()
        .instance()
        .get(&Symbol::new(env, key))
        .ok_or(missing)
}

/// Load the administrator recorded under `admin_key` and authorise this
/// invocation as that administrator.
///
/// This is the storage-backed counterpart to [`assert_is_admin`]. Most contracts
/// do not take the caller as an argument — they simply authorise whoever is
/// currently recorded — and until now each one re-wrote these four lines by hand.
/// `admin_key` is generic so a contract keeps its own key type (a `#[contracttype]`
/// enum or a `Symbol`).
///
/// Missing storage reports [`ContractError::NotInitialized`], because no admin
/// can be authorised until the contract has been initialised.
///
/// The caller performs no separate `require_auth()` step: authorisation happens
/// here, and the returned address is available if the caller wants to record it
/// in an event.
pub fn require_admin<K>(env: &Env, admin_key: &K) -> Result<Address, ContractError>
where
    K: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    let admin: Address = env
        .storage()
        .instance()
        .get(admin_key)
        .ok_or(ContractError::NotInitialized)?;
    admin.require_auth();
    Ok(admin)
}

/// Assert `admin` is the address recorded under `admin_key`.
///
/// The caller is expected to have invoked `admin.require_auth()` already; this
/// helper only answers "is this the recorded admin?", so auth and authorisation
/// stay as two separately testable steps.
///
/// Missing storage reports [`ContractError::NotFound`], matching the
/// "no such administrator" reading used by every admin entrypoint.
pub fn assert_is_admin(env: &Env, admin: &Address, admin_key: &str) -> Result<(), ContractError> {
    let stored: Address = instance_get(env, admin_key, ContractError::NotFound)?;
    if *admin != stored {
        return Err(ContractError::Unauthorized);
    }
    Ok(())
}

/// Assert `signer` appears in the signer set recorded under `signers_key`.
///
/// Like [`assert_is_admin`], this only checks membership — the caller performs
/// `signer.require_auth()` itself.
///
/// Missing storage reports [`ContractError::NotInitialized`], because a signer
/// set only exists once the contract has been initialised.
pub fn assert_is_signer(
    env: &Env,
    signer: &Address,
    signers_key: &str,
) -> Result<(), ContractError> {
    let signers: Vec<Address> = instance_get(env, signers_key, ContractError::NotInitialized)?;
    if !signers.contains(signer.clone()) {
        return Err(ContractError::Unauthorized);
    }
    Ok(())
}

/// Authorization error types
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AuthError {
    Unauthorized = 1,
    NotAdmin = 2,
    InvalidSigner = 3,
    InsufficientPermissions = 4,
}

/// Compute the required threshold for a given `value` and return it.
pub fn required_threshold(full_threshold: u32, high_value_limit: i128, value: i128) -> u32 {
    policy_required_threshold(full_threshold, high_value_limit, value)
}

/// Verify the threshold against the policy.
pub fn verify_threshold(
    sig_count: u32,
    full_threshold: u32,
    high_value_limit: i128,
    value: i128,
) -> Result<u32, ContractError> {
    policy_verify_threshold(sig_count, full_threshold, high_value_limit, value)
}

/// Admin authorization helper
pub struct AdminAuth;

impl AdminAuth {
    /// Require that the caller is the admin
    pub fn require_admin(_env: &Env, _admin: &Address, caller: &Address) -> Result<(), AuthError> {
        if caller != _admin {
            return Err(AuthError::NotAdmin);
        }
        caller.require_auth();
        Ok(())
    }

    /// Require that the caller is either the admin or has a specific role
    pub fn require_admin_or_role(
        _env: &Env,
        _admin: &Address,
        caller: &Address,
        role_check: fn(&Address) -> bool,
    ) -> Result<(), AuthError> {
        if caller == _admin {
            caller.require_auth();
            return Ok(());
        }
        if role_check(caller) {
            caller.require_auth();
            return Ok(());
        }
        Err(AuthError::Unauthorized)
    }

    /// Require that the caller has a specific role
    pub fn require_role(
        _env: &Env,
        caller: &Address,
        role_check: fn(&Address) -> bool,
    ) -> Result<(), AuthError> {
        if !role_check(caller) {
            return Err(AuthError::InsufficientPermissions);
        }
        caller.require_auth();
        Ok(())
    }

    /// Check if the caller is the admin without throwing an error
    pub fn is_admin(_env: &Env, _admin: &Address, caller: &Address) -> bool {
        if caller != _admin {
            return false;
        }
        caller.require_auth();
        true
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // ── required_threshold ──────────────────────────────────────

    #[test]
    fn threshold_zero_signers_is_full() {
        assert_eq!(required_threshold(3, 0, 1_000), 3);
    }

    #[test]
    fn threshold_value_below_limit_returns_one() {
        assert_eq!(required_threshold(3, 1_000, 500), 1);
    }

    proptest! {
        #[test]
        fn required_threshold_policy_invariant_holds(
            full_threshold in 1u32..=32u32,
            high_value_limit in 0i128..=1_000_000_000i128,
            value in 0i128..=1_000_000_000i128,
        ) {
            let required = required_threshold(full_threshold, high_value_limit, value);
            if high_value_limit > 0 && value <= high_value_limit {
                prop_assert_eq!(required, 1);
            } else {
                prop_assert_eq!(required, full_threshold);
            }
        }

        #[test]
        fn verify_threshold_matches_the_policy_invariant(
            sig_count in 0u32..=32u32,
            full_threshold in 1u32..=32u32,
            high_value_limit in 0i128..=1_000_000_000i128,
            value in 0i128..=1_000_000_000i128,
        ) {
            let required = required_threshold(full_threshold, high_value_limit, value);
            let ok = verify_threshold(sig_count, full_threshold, high_value_limit, value);

            if sig_count >= required {
                prop_assert!(ok.is_ok());
            } else {
                prop_assert_eq!(ok.unwrap_err(), ContractError::BelowThreshold);
            }
        }
    }
}

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

use soroban_sdk::{Address, Env, Symbol, Vec, panic_with_error};

use crate::{errors::ContractError, policy::{required_threshold, verify_threshold}};

/// Authorization error types
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AuthError {
    Unauthorized = 1,
    NotAdmin = 2,
    InvalidSigner = 3,
    InsufficientPermissions = 4,
}

/// Admin authorization helper
pub struct AdminAuth;

impl AdminAuth {
    /// Require that the caller is the admin
    pub fn require_admin(env: &Env, admin: &Address, caller: &Address) -> Result<(), AuthError> {
        // First, check that the caller address matches the admin
        if caller != admin {
            return Err(AuthError::NotAdmin);
        }

        // Then, require auth for the caller
        caller.require_auth();

        Ok(())
    }

    /// Require that the caller is either the admin or has a specific role
    pub fn require_admin_or_role(
        env: &Env,
        admin: &Address,
        caller: &Address,
        role_check: fn(&Address) -> bool,
    ) -> Result<(), AuthError> {
        if caller == admin {
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
        env: &Env,
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
    pub fn is_admin(env: &Env, admin: &Address, caller: &Address) -> bool {
        if caller != admin {
            return false;
        }

        // Try to authenticate
        match caller.try_require_auth() {
            Ok(_) => true,
            Err(_) => false,
        }
    }

    /// Compute the required threshold for a given `value` and return it.
    ///
    /// The policy logic is isolated in `crate::policy` so the auth layer can remain
    /// storage-focused while business rules stay in one place.
    pub use crate::policy::{required_threshold, verify_threshold};
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    // ── required_threshold ────────────────────────────────────────────────────

    #[test]
    fn threshold_zero_signers_is_full() {
        // high_value_limit = 0 means "always use full threshold"
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
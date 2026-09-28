//! Policy-level limit logic for Stellar-Spend contracts.
//!
//! This module intentionally isolates policy decisions from the core transfer and
//! approval flow. Contract entrypoints can continue to call the general-purpose
//! helpers without hard-coding a particular threshold model into business logic.
//!
//! # Invariants
//! - `required_threshold` is exactly `1` whenever a value is at or below the
//!   configured high-value limit and that limit is positive.
//! - Otherwise it falls back to the full quorum threshold.
//! - `verify_threshold` accepts exactly when the provided signature count meets or
//!   exceeds the policy-derived threshold.

use crate::errors::ContractError;

/// Compute the required threshold for a given `value` and return it.
///
/// The policy is intentionally small and isolated: it answers "how many
/// signatures does this action require?" without mutating storage or handling
/// auth directly.
pub fn required_threshold(full_threshold: u32, high_value_limit: i128, value: i128) -> u32 {
    if high_value_limit > 0 && value <= high_value_limit {
        1
    } else {
        full_threshold
    }
}

/// Returns `Ok(sig_count)` if `sig_count >= required_threshold(…)`, otherwise
/// `Err(ContractError::BelowThreshold)`.
pub fn verify_threshold(
    sig_count: u32,
    full_threshold: u32,
    high_value_limit: i128,
    value: i128,
) -> Result<u32, ContractError> {
    let needed = required_threshold(full_threshold, high_value_limit, value);
    if sig_count >= needed {
        Ok(sig_count)
    } else {
        Err(ContractError::BelowThreshold)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn threshold_zero_limit_is_full() {
        assert_eq!(required_threshold(3, 0, 1_000), 3);
    }

    #[test]
    fn threshold_value_below_limit_returns_one() {
        assert_eq!(required_threshold(3, 1_000, 500), 1);
    }

    #[test]
    fn threshold_value_at_limit_returns_one() {
        assert_eq!(required_threshold(3, 1_000, 1_000), 1);
    }

    #[test]
    fn threshold_value_above_limit_returns_full() {
        assert_eq!(required_threshold(3, 1_000, 1_001), 3);
    }

    #[test]
    fn verify_exact_threshold_passes() {
        assert!(verify_threshold(3, 3, 0, 9_999).is_ok());
    }

    #[test]
    fn verify_below_threshold_fails() {
        let err = verify_threshold(2, 3, 0, 9_999).unwrap_err();
        assert_eq!(err, ContractError::BelowThreshold);
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

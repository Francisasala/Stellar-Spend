//! Property-based tests for the treasury balance arithmetic (issue #1157).
//!
//! The fixed-value suite in `treasury::tests` pins specific boundaries —
//! `i128::MAX`, zero, one stroop past the limit. Those are the cases a human
//! thinks of. These properties search the rest of the domain instead, and are
//! written against what must *never* happen:
//!
//! * `add` must report overflow rather than wrap a positive sum negative.
//! * `sub` must report insufficiency rather than borrow past zero.
//! * `validate_balance` must accept exactly the non-negative balances.
//! * `safe_mul` must equal checked multiplication followed by truncation.
//! * The contract ledger must keep `available + reserved == total_balance`.
//!
//! The `BalanceManager` itself is pure, so its properties run thousands of
//! cases cheaply; the contract-level properties construct one `Env` per case,
//! which is enough to cover the wiring between the manager and storage.

use proptest::prelude::*;
use stellar_spend_shared::errors::ContractError;
use treasury::balance::BalanceManager;
use treasury::test_utils::TreasuryTest;

/// `i128` drawn from the whole domain, weighted towards the extremes where
/// arithmetic actually breaks.
fn balance() -> impl Strategy<Value = i128> {
    prop_oneof![
        Just(i128::MIN),
        Just(i128::MAX),
        Just(0i128),
        Just(-1i128),
        (i128::MAX - 1_000)..=i128::MAX,
        i128::MIN..=(i128::MIN + 1_000),
        -1_000i128..=1_000,
        any::<i128>(),
    ]
}

/// Non-negative balances, still including the top of the range.
fn non_negative() -> impl Strategy<Value = i128> {
    prop_oneof![
        Just(0i128),
        Just(1i128),
        0i128..=1_000_000_000_000,
        (i128::MAX - 1_000)..=i128::MAX,
        any::<u64>().prop_map(|v| v as i128),
    ]
}

/// Amounts small enough that `amount * basis_points` always fits in `i128`.
fn fee_amount() -> impl Strategy<Value = i128> {
    0i128..=(i128::MAX / 10_000)
}

/// Basis points, capped the way the contract caps them.
fn basis_points() -> impl Strategy<Value = i128> {
    0i128..=10_000
}

proptest! {
    // ── BalanceManager::add ──────────────────────────────────────────────────

    /// Out-of-range sums are reported, never wrapped.
    #[test]
    fn add_reports_overflow_instead_of_wrapping(current in balance(), amount in balance()) {
        let result = BalanceManager::add(current, amount);
        if amount < 0 {
            prop_assert_eq!(result, Err(ContractError::InvalidAmount));
        } else {
            match current.checked_add(amount) {
                Some(sum) => prop_assert_eq!(result, Ok(sum)),
                None => prop_assert_eq!(result, Err(ContractError::ArithmeticOverflow)),
            }
        }
    }

    #[test]
    fn add_is_commutative_when_both_operands_fit(a in non_negative(), b in non_negative()) {
        prop_assume!(a.checked_add(b).is_some());
        prop_assert_eq!(
            BalanceManager::add(a, b),
            BalanceManager::add(b, a),
            "add(a, b) and add(b, a) must agree"
        );
    }

    #[test]
    fn add_then_sub_is_the_identity(current in non_negative(), amount in non_negative()) {
        prop_assume!(current.checked_add(amount).is_some());
        let added = BalanceManager::add(current, amount).expect("sum fits");
        prop_assert_eq!(BalanceManager::sub(added, amount), Ok(current));
    }

    // ── BalanceManager::sub ──────────────────────────────────────────────────

    /// Underflow is reported, never borrowed into a huge positive balance.
    #[test]
    fn sub_reports_underflow_instead_of_wrapping(current in balance(), amount in balance()) {
        let result = BalanceManager::sub(current, amount);
        if amount < 0 {
            prop_assert_eq!(result, Err(ContractError::InvalidAmount));
        } else if amount > current {
            prop_assert_eq!(result, Err(ContractError::InsufficientBalance));
        } else {
            prop_assert_eq!(result, Ok(current - amount));
        }
    }

    // ── BalanceManager::validate_balance ─────────────────────────────────────

    #[test]
    fn validate_balance_accepts_exactly_the_non_negative(balance in balance()) {
        let expected = if balance < 0 {
            Err(ContractError::InvalidAmount)
        } else {
            Ok(())
        };
        prop_assert_eq!(BalanceManager::validate_balance(balance), expected);
    }

    // ── BalanceManager::safe_mul ─────────────────────────────────────────────

    #[test]
    fn safe_mul_matches_checked_arithmetic(value in balance(), multiplier in balance()) {
        let result = BalanceManager::safe_mul(value, multiplier);
        if value < 0 || multiplier < 0 {
            prop_assert_eq!(result, Err(ContractError::InvalidAmount));
        } else {
            match value.checked_mul(multiplier) {
                Some(product) => prop_assert_eq!(result, Ok(product / 10_000)),
                None => prop_assert_eq!(result, Err(ContractError::ArithmeticOverflow)),
            }
        }
    }

    /// Truncation is exact: never round up, and never lose a whole basis point.
    #[test]
    fn safe_mul_truncates_toward_zero(
        value in fee_amount(),
        multiplier in basis_points(),
    ) {
        let fee = BalanceManager::safe_mul(value, multiplier).expect("fits");
        let product = value * multiplier;

        prop_assert!(fee * 10_000 <= product, "must never round up");
        prop_assert!(
            product - fee * 10_000 < 10_000,
            "must never drop a whole basis point"
        );
    }
}

// ── Contract-level properties ────────────────────────────────────────────────

proptest! {
    #[test]
    fn deposit_then_withdraw_returns_to_an_empty_ledger(amount in 0i128..1_000_000_000_000i128) {
        let t = TreasuryTest::registered();
        t.client().initialize(&t.admin);

        prop_assert_eq!(t.client().deposit(&amount), amount);
        prop_assert_eq!(t.client().withdraw(&amount), 0i128);

        let state = t.client().get_state();
        prop_assert_eq!(state.total_balance, 0);
        prop_assert_eq!(state.reserved, 0);
        prop_assert_eq!(state.available, 0);
    }

    #[test]
    fn available_plus_reserved_always_equals_the_total(
        total in 0i128..1_000_000_000_000i128,
        wanted in 0i128..1_000_000_000_000i128,
    ) {
        let t = TreasuryTest::registered();
        t.client().initialize(&t.admin);
        t.client().deposit(&total);

        // Only reserve what the ledger actually holds; anything larger is an
        // underflow case, which the fixed-value suite already pins.
        let portion = total.min(wanted);
        t.client().reserve(&portion);

        let state = t.client().get_state();
        prop_assert_eq!(
            state.available + state.reserved,
            state.total_balance,
            "the split must account for the whole balance"
        );
        prop_assert_eq!(state.total_balance, total);
        prop_assert_eq!(state.reserved, portion);
        prop_assert_eq!(state.available, total - portion);
    }

    #[test]
    fn a_negative_amount_never_reaches_the_ledger(amount in i128::MIN..0) {
        let t = TreasuryTest::registered();
        t.client().initialize(&t.admin);

        prop_assert_eq!(
            t.client().try_deposit(&amount),
            Err(Ok(ContractError::InvalidAmount))
        );
        prop_assert_eq!(
            t.client().try_withdraw(&amount),
            Err(Ok(ContractError::InvalidAmount))
        );

        let state = t.client().get_state();
        prop_assert_eq!(state.total_balance, 0);
        prop_assert_eq!(state.available, 0);
    }

    #[test]
    fn withdrawing_more_than_the_ledger_holds_is_reported(
        held in 0i128..1_000_000_000_000i128,
        extra in 1i128..1_000_000_000_000i128,
    ) {
        let t = TreasuryTest::registered();
        t.client().initialize(&t.admin);
        t.client().deposit(&held);

        prop_assert_eq!(
            t.client().try_withdraw(&(held + extra)),
            Err(Ok(ContractError::InsufficientBalance))
        );

        let state = t.client().get_state();
        prop_assert_eq!(state.total_balance, held, "a rejected withdrawal must not mutate state");
    }
}

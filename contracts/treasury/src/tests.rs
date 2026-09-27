//! Contract-level tests for the treasury balance ledger (issue #988).
//!
//! These exercise `deposit`/`withdraw`/`reserve` through the generated client so the
//! calls run inside a contract frame — calling the entrypoints as plain Rust
//! functions would touch instance storage with no current contract and panic.

#![cfg(test)]

use stellar_spend_shared::errors::ContractError;

use crate::test_utils::TreasuryTest;

/// A fixture whose balance ledger — rather than just the fee schedule — is open.
fn ledger() -> TreasuryTest {
    let t = TreasuryTest::registered();
    t.client().initialize(&t.admin);
    t
}

#[test]
fn test_initialize_treasury() {
    let t = ledger();

    let state = t.client().get_state();
    assert_eq!(state.total_balance, 0);
    assert_eq!(state.reserved, 0);
    assert_eq!(state.available, 0);
}

#[test]
fn test_initialize_is_rejected_twice() {
    let t = ledger();

    assert_eq!(
        t.client().try_initialize(&t.admin),
        Err(Ok(ContractError::AlreadyInitialized))
    );
}

#[test]
fn test_deposit_overflow_protection() {
    let t = ledger();

    // Deposit a large amount
    assert_eq!(t.client().deposit(&(i128::MAX / 2)), i128::MAX / 2);

    // Anything that would carry the balance past i128::MAX must be reported, not
    // allowed to wrap.
    assert_eq!(
        t.client().try_deposit(&i128::MAX),
        Err(Ok(ContractError::ArithmeticOverflow))
    );
}

#[test]
fn test_withdraw_overflow_protection() {
    let t = ledger();

    t.client().deposit(&1000);

    // Withdraw all
    assert_eq!(t.client().withdraw(&1000), 0);

    // Try to withdraw more than available
    assert_eq!(
        t.client().try_withdraw(&1),
        Err(Ok(ContractError::InsufficientBalance))
    );
}

#[test]
fn test_reserve_overflow_protection() {
    let t = ledger();

    t.client().deposit(&1000);

    // Reserve funds
    assert_eq!(t.client().reserve(&500), 500);

    // Try to reserve more than available
    assert_eq!(
        t.client().try_reserve(&600),
        Err(Ok(ContractError::InsufficientBalance))
    );
}

#[test]
fn test_release_reserved_overflow_protection() {
    let t = ledger();

    // Deposit and reserve
    t.client().deposit(&1000);
    t.client().reserve(&500);

    // Release reserved
    t.client().release_reserved(&300);

    let state = t.client().get_state();
    assert_eq!(state.reserved, 200);
    assert_eq!(state.available, 800);

    // Try to release more than reserved
    assert_eq!(
        t.client().try_release_reserved(&300),
        Err(Ok(ContractError::InsufficientBalance))
    );
}

#[test]
fn test_state_consistency_after_operations() {
    let t = ledger();

    // Multiple operations
    t.client().deposit(&1000);
    t.client().reserve(&300);
    t.client().deposit(&500);
    t.client().release_reserved(&100);
    t.client().withdraw(&200);

    let state = t.client().get_state();
    assert_eq!(state.total_balance, 1300); // 1000 + 500 - 200
    assert_eq!(state.reserved, 200); // 300 - 100
    assert_eq!(state.available, 1100); // 1300 - 200
}

#[test]
fn test_near_max_balance_operations() {
    let t = ledger();

    // Deposit near MAX
    let near_max = i128::MAX - 100;
    assert_eq!(t.client().deposit(&near_max), near_max);

    // Withdraw a small amount
    assert_eq!(t.client().withdraw(&50), near_max - 50);

    // 150 stroops of headroom are left; filling it exactly is fine...
    assert_eq!(t.client().deposit(&150), i128::MAX);

    // ...and one stroop past it must be reported rather than wrapped.
    assert_eq!(
        t.client().try_deposit(&1),
        Err(Ok(ContractError::ArithmeticOverflow))
    );
}

#[test]
fn test_zero_amount_operations() {
    let t = ledger();

    assert_eq!(t.client().try_deposit(&0), Ok(Ok(0)));
    assert_eq!(t.client().try_withdraw(&0), Ok(Ok(0)));
    assert_eq!(t.client().try_reserve(&0), Ok(Ok(0)));
    assert_eq!(t.client().try_release_reserved(&0), Ok(Ok(0)));

    let state = t.client().get_state();
    assert_eq!(state.total_balance, 0);
    assert_eq!(state.reserved, 0);
    assert_eq!(state.available, 0);
}

#[test]
fn test_negative_amount_rejection() {
    let t = ledger();

    // Try to deposit negative
    assert_eq!(
        t.client().try_deposit(&-100),
        Err(Ok(ContractError::InvalidAmount))
    );

    // Try to withdraw negative
    assert_eq!(
        t.client().try_withdraw(&-100),
        Err(Ok(ContractError::InvalidAmount))
    );
}

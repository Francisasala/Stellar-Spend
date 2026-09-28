#![cfg(test)]
use super::*;
use soroban_sdk::{Env, Address};

#[test]
fn test_initialize_treasury() {
    let env = Env::default();
    let admin = Address::random(&env);

    let result = TreasuryContract::initialize(env.clone(), admin);
    assert!(result.is_ok());

    let state = TreasuryContract::get_state(env).unwrap();
    assert_eq!(state.total_balance, 0);
    assert_eq!(state.reserved, 0);
    assert_eq!(state.available, 0);
}

#[test]
fn test_deposit_overflow_protection() {
    let env = Env::default();
    let admin = Address::random(&env);

    TreasuryContract::initialize(env.clone(), admin).unwrap();

    // Deposit a large amount
    let result = TreasuryContract::deposit(env.clone(), i128::MAX / 2);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), i128::MAX / 2);

    // Try to deposit beyond MAX
    let result = TreasuryContract::deposit(env.clone(), i128::MAX / 2 + 1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::ArithmeticOverflow);
}

#[test]
fn test_withdraw_overflow_protection() {
    let env = Env::default();
    let admin = Address::random(&env);

    TreasuryContract::initialize(env.clone(), admin).unwrap();

    // Deposit first
    TreasuryContract::deposit(env.clone(), 1000).unwrap();

    // Withdraw all
    let result = TreasuryContract::withdraw(env.clone(), 1000);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 0);

    // Try to withdraw more than available
    let result = TreasuryContract::withdraw(env.clone(), 1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::InsufficientBalance);
}

#[test]
fn test_reserve_overflow_protection() {
    let env = Env::default();
    let admin = Address::random(&env);

    TreasuryContract::initialize(env.clone(), admin).unwrap();

    // Deposit
    TreasuryContract::deposit(env.clone(), 1000).unwrap();

    // Reserve funds
    let result = TreasuryContract::reserve(env.clone(), 500);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 500);

    // Try to reserve more than available
    let result = TreasuryContract::reserve(env.clone(), 600);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::InsufficientBalance);
}

#[test]
fn test_release_reserved_overflow_protection() {
    let env = Env::default();
    let admin = Address::random(&env);

    TreasuryContract::initialize(env.clone(), admin).unwrap();

    // Deposit and reserve
    TreasuryContract::deposit(env.clone(), 1000).unwrap();
    TreasuryContract::reserve(env.clone(), 500).unwrap();

    // Release reserved
    let result = TreasuryContract::release_reserved(env.clone(), 300);
    assert!(result.is_ok());

    // Check state
    let state = TreasuryContract::get_state(env.clone()).unwrap();
    assert_eq!(state.reserved, 200);
    assert_eq!(state.available, 800);

    // Try to release more than reserved
    let result = TreasuryContract::release_reserved(env.clone(), 300);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::InsufficientBalance);
}

#[test]
fn test_state_consistency_after_operations() {
    let env = Env::default();
    let admin = Address::random(&env);

    TreasuryContract::initialize(env.clone(), admin).unwrap();

    // Multiple operations
    TreasuryContract::deposit(env.clone(), 1000).unwrap();
    TreasuryContract::reserve(env.clone(), 300).unwrap();
    TreasuryContract::deposit(env.clone(), 500).unwrap();
    TreasuryContract::release_reserved(env.clone(), 100).unwrap();
    TreasuryContract::withdraw(env.clone(), 200).unwrap();

    let state = TreasuryContract::get_state(env).unwrap();
    assert_eq!(state.total_balance, 1300); // 1000 + 500 - 200
    assert_eq!(state.reserved, 200); // 300 - 100
    assert_eq!(state.available, 1100); // 1300 - 200
}

#[test]
fn test_near_max_balance_operations() {
    let env = Env::default();
    let admin = Address::random(&env);

    TreasuryContract::initialize(env.clone(), admin).unwrap();

    // Deposit near MAX
    let near_max = i128::MAX - 100;
    let result = TreasuryContract::deposit(env.clone(), near_max);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), near_max);

    // Withdraw a small amount
    let result = TreasuryContract::withdraw(env.clone(), 50);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), near_max - 50);

    // Try to deposit remaining amount to reach MAX
    let result = TreasuryContract::deposit(env.clone(), 100);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::ArithmeticOverflow);
}

#[test]
fn test_zero_amount_operations() {
    let env = Env::default();
    let admin = Address::random(&env);

    TreasuryContract::initialize(env.clone(), admin).unwrap();

    // Deposit zero
    let result = TreasuryContract::deposit(env.clone(), 0);
    assert!(result.is_ok());

    // Withdraw zero
    let result = TreasuryContract::withdraw(env.clone(), 0);
    assert!(result.is_ok());

    // Reserve zero
    let result = TreasuryContract::reserve(env.clone(), 0);
    assert!(result.is_ok());

    // Release reserved zero
    let result = TreasuryContract::release_reserved(env.clone(), 0);
    assert!(result.is_ok());

    let state = TreasuryContract::get_state(env).unwrap();
    assert_eq!(state.total_balance, 0);
    assert_eq!(state.reserved, 0);
    assert_eq!(state.available, 0);
}

#[test]
fn test_negative_amount_rejection() {
    let env = Env::default();
    let admin = Address::random(&env);

    TreasuryContract::initialize(env.clone(), admin).unwrap();

    // Try to deposit negative
    let result = TreasuryContract::deposit(env.clone(), -100);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::InvalidAmount);

    // Try to withdraw negative
    let result = TreasuryContract::withdraw(env.clone(), -100);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), ContractError::InvalidAmount);
}

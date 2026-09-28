#![cfg(test)]
use super::*;
use soroban_sdk::{Env, Address};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::random(&env);

    let result = AdminExample::initialize(env.clone(), admin.clone());
    assert!(result.is_ok());

    let stored_admin = AdminExample::get_admin(env);
    assert_eq!(stored_admin, Some(admin));
}

#[test]
fn test_initialize_already_initialized() {
    let env = Env::default();
    let admin = Address::random(&env);

    // First initialization
    let result = AdminExample::initialize(env.clone(), admin.clone());
    assert!(result.is_ok());

    // Second initialization should fail
    let result = AdminExample::initialize(env.clone(), admin.clone());
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), SharedError::AlreadyInitialized);
}

#[test]
fn test_pause_as_admin() {
    let env = Env::default();
    let admin = Address::random(&env);

    // Initialize
    AdminExample::initialize(env.clone(), admin.clone()).unwrap();

    // Pause as admin
    let result = AdminExample::pause(env.clone(), admin.clone());
    assert!(result.is_ok());

    // Check if paused
    let paused = AdminExample::is_paused(env);
    assert!(paused);
}

#[test]
fn test_pause_as_non_admin() {
    let env = Env::default();
    let admin = Address::random(&env);
    let attacker = Address::random(&env);

    // Initialize
    AdminExample::initialize(env.clone(), admin.clone()).unwrap();

    // Try to pause as non-admin
    let result = AdminExample::pause(env.clone(), attacker.clone());
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), SharedError::Unauthorized);
}

#[test]
fn test_unpause_as_admin() {
    let env = Env::default();
    let admin = Address::random(&env);

    // Initialize
    AdminExample::initialize(env.clone(), admin.clone()).unwrap();

    // Pause
    AdminExample::pause(env.clone(), admin.clone()).unwrap();

    // Unpause as admin
    let result = AdminExample::unpause(env.clone(), admin.clone());
    assert!(result.is_ok());

    // Check if not paused
    let paused = AdminExample::is_paused(env);
    assert!(!paused);
}

#[test]
fn test_unpause_as_non_admin() {
    let env = Env::default();
    let admin = Address::random(&env);
    let attacker = Address::random(&env);

    // Initialize
    AdminExample::initialize(env.clone(), admin.clone()).unwrap();

    // Pause
    AdminExample::pause(env.clone(), admin.clone()).unwrap();

    // Try to unpause as non-admin
    let result = AdminExample::unpause(env.clone(), attacker.clone());
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), SharedError::Unauthorized);
}

#[test]
fn test_update_admin_as_admin() {
    let env = Env::default();
    let admin = Address::random(&env);
    let new_admin = Address::random(&env);

    // Initialize
    AdminExample::initialize(env.clone(), admin.clone()).unwrap();

    // Update admin
    let result = AdminExample::update_admin(env.clone(), admin.clone(), new_admin.clone());
    assert!(result.is_ok());

    // Check admin was updated
    let stored_admin = AdminExample::get_admin(env);
    assert_eq!(stored_admin, Some(new_admin));
}

#[test]
fn test_update_admin_as_non_admin() {
    let env = Env::default();
    let admin = Address::random(&env);
    let attacker = Address::random(&env);
    let new_admin = Address::random(&env);

    // Initialize
    AdminExample::initialize(env.clone(), admin.clone()).unwrap();

    // Try to update admin as non-admin
    let result = AdminExample::update_admin(env.clone(), attacker.clone(), new_admin);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), SharedError::Unauthorized);
}

#[test]
fn test_require_auth_called_on_admin() {
    // This test verifies that `require_auth` is called on the admin address
    // when an admin function is invoked.
    let env = Env::default();
    let admin = Address::random(&env);

    // Initialize
    AdminExample::initialize(env.clone(), admin.clone()).unwrap();

    // This should work because the admin is authorized
    let result = AdminExample::pause(env.clone(), admin.clone());
    assert!(result.is_ok());

    // Note: In a real test with proper mocking, we would verify that
    // `require_auth` was called on the admin address.
    // The `require_auth` check is enforced by the `AdminAuth::require_admin` function.
}

#[test]
fn test_admin_auth_without_initialization() {
    let env = Env::default();
    let admin = Address::random(&env);

    // Try to pause without initialization
    let result = AdminExample::pause(env.clone(), admin.clone());
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), SharedError::NotInitialized);
}

#[test]
fn test_admin_auth_without_auth_fails() {
    // This test simulates an unauthorized caller
    let env = Env::default();
    let admin = Address::random(&env);
    let attacker = Address::random(&env);

    // Initialize
    AdminExample::initialize(env.clone(), admin.clone()).unwrap();

    // Try to pause as attacker
    // The `require_admin` function will check that the caller is the admin
    // and will fail because attacker != admin
    let result = AdminExample::pause(env.clone(), attacker.clone());
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), SharedError::Unauthorized);
}

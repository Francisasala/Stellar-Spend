#![no_std]
use soroban_sdk::{contract, contracttype, Address, Env, String, panic_with_error};
use shared::{AdminAuth, AuthError, SharedError};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminState {
    pub admin: Address,
    pub initialized: bool,
    pub paused: bool,
}

#[contract]
pub struct AdminExample;

#[contractimpl]
impl AdminExample {
    /// Initialize the contract with an admin
    pub fn initialize(
        env: Env,
        admin: Address,
    ) -> Result<(), SharedError> {
        // Check if already initialized
        let state: Option<AdminState> = env.storage().get(&String::from_str(&env, "state"));
        if state.is_some() {
            return Err(SharedError::AlreadyInitialized);
        }

        // Store admin
        let state = AdminState {
            admin: admin.clone(),
            initialized: true,
            paused: false,
        };
        env.storage().set(&String::from_str(&env, "state"), &state);

        // Emit event
        env.events().publish(
            ("admin_initialized", "v1"),
            (admin, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Admin-only: Pause the contract
    pub fn pause(
        env: Env,
        caller: Address,
    ) -> Result<(), SharedError> {
        // 1. Get the state
        let mut state: AdminState = env.storage()
            .get(&String::from_str(&env, "state"))
            .ok_or(SharedError::NotInitialized)?;

        // 2. Require admin authorization
        // This checks that the caller is the admin AND that they have signed
        AdminAuth::require_admin(&env, &state.admin, &caller)
            .map_err(|_| SharedError::Unauthorized)?;

        // 3. Update state
        state.paused = true;
        env.storage().set(&String::from_str(&env, "state"), &state);

        // 4. Emit event
        env.events().publish(
            ("contract_paused", "v1"),
            (caller, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Admin-only: Unpause the contract
    pub fn unpause(
        env: Env,
        caller: Address,
    ) -> Result<(), SharedError> {
        let mut state: AdminState = env.storage()
            .get(&String::from_str(&env, "state"))
            .ok_or(SharedError::NotInitialized)?;

        // Require admin authorization
        AdminAuth::require_admin(&env, &state.admin, &caller)
            .map_err(|_| SharedError::Unauthorized)?;

        state.paused = false;
        env.storage().set(&String::from_str(&env, "state"), &state);

        env.events().publish(
            ("contract_unpaused", "v1"),
            (caller, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Admin-only: Update admin address
    pub fn update_admin(
        env: Env,
        caller: Address,
        new_admin: Address,
    ) -> Result<(), SharedError> {
        let mut state: AdminState = env.storage()
            .get(&String::from_str(&env, "state"))
            .ok_or(SharedError::NotInitialized)?;

        // Require admin authorization
        AdminAuth::require_admin(&env, &state.admin, &caller)
            .map_err(|_| SharedError::Unauthorized)?;

        // Update admin
        state.admin = new_admin.clone();
        env.storage().set(&String::from_str(&env, "state"), &state);

        env.events().publish(
            ("admin_updated", "v1"),
            (caller, new_admin, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Public: Check if contract is paused
    pub fn is_paused(
        env: Env,
    ) -> bool {
        let state: Option<AdminState> = env.storage().get(&String::from_str(&env, "state"));
        state.map(|s| s.paused).unwrap_or(false)
    }

    /// Public: Get admin address
    pub fn get_admin(
        env: Env,
    ) -> Option<Address> {
        let state: Option<AdminState> = env.storage().get(&String::from_str(&env, "state"));
        state.map(|s| s.admin)
    }
}

#[cfg(test)]
mod tests;

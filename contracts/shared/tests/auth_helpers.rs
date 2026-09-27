//! Tests for the shared authorisation helpers in `stellar_spend_shared::auth`.
//!
//! The helpers live in `shared`, but they only behave meaningfully inside a real
//! contract frame (instance storage and `require_auth` both need one), so they
//! are exercised here through a purpose-built harness contract rather than from
//! `shared`'s own `#[cfg(test)]` module.

use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, Env, Symbol, Vec};
use stellar_spend_shared::auth::{assert_is_admin, assert_is_signer, require_admin};
use stellar_spend_shared::errors::ContractError;

/// Instance-storage key the harness records its administrator under.
const ADMIN_KEY: &str = "admin";
/// Instance-storage key the harness records its signer set under.
const SIGNERS_KEY: &str = "signers";

#[contract]
pub struct AuthHarness;

#[contractimpl]
impl AuthHarness {
    /// Record `admin`. No authorisation: this is fixture setup only.
    pub fn set_admin(env: Env, admin: Address) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, ADMIN_KEY), &admin);
    }

    /// Record a signer set. Fixture setup only.
    pub fn set_signers(env: Env, signers: Vec<Address>) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, SIGNERS_KEY), &signers);
    }

    /// Gate on the recorded administrator authorising the call.
    pub fn admin_gate(env: Env) -> Result<Address, ContractError> {
        require_admin(&env, &Symbol::new(&env, ADMIN_KEY))
    }

    /// Gate on `admin` being the recorded administrator.
    pub fn named_admin_gate(env: Env, admin: Address) -> Result<(), ContractError> {
        assert_is_admin(&env, &admin, ADMIN_KEY)
    }

    /// Gate on `signer` appearing in the recorded signer set.
    pub fn signer_gate(env: Env, signer: Address) -> Result<(), ContractError> {
        assert_is_signer(&env, &signer, SIGNERS_KEY)
    }
}

struct Fixture {
    env: Env,
    contract: AuthHarnessClient<'static>,
    admin: Address,
    outsider: Address,
}

/// A harness contract with `admin` recorded and auth mocking enabled.
fn fixture() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();
    let contract = AuthHarnessClient::new(&env, &env.register(AuthHarness, ()));
    let admin = Address::generate(&env);
    let outsider = Address::generate(&env);
    contract.set_admin(&admin);
    Fixture {
        env,
        contract,
        admin,
        outsider,
    }
}

// ── require_admin ────────────────────────────────────────────────────────────

#[test]
fn require_admin_returns_the_recorded_administrator() {
    let f = fixture();
    assert_eq!(f.contract.admin_gate(), f.admin);
}

#[test]
fn require_admin_reports_a_contract_that_was_never_initialised() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = AuthHarnessClient::new(&env, &env.register(AuthHarness, ()));

    assert_eq!(
        contract.try_admin_gate(),
        Err(Ok(ContractError::NotInitialized))
    );
}

// ── assert_is_admin ──────────────────────────────────────────────────────────

#[test]
fn assert_is_admin_accepts_the_recorded_administrator() {
    let f = fixture();
    assert_eq!(f.contract.try_named_admin_gate(&f.admin), Ok(Ok(())));
}

#[test]
fn assert_is_admin_rejects_a_different_address() {
    let f = fixture();
    assert_eq!(
        f.contract.try_named_admin_gate(&f.outsider),
        Err(Ok(ContractError::Unauthorized))
    );
}

#[test]
fn assert_is_admin_reports_missing_storage_as_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = AuthHarnessClient::new(&env, &env.register(AuthHarness, ()));
    let caller = Address::generate(&env);

    // Deliberately `NotFound` rather than `NotInitialized`: an absent admin
    // record reads as "no such administrator". Pinned by
    // `multisig-authority/tests/upgrade.rs`.
    assert_eq!(
        contract.try_named_admin_gate(&caller),
        Err(Ok(ContractError::NotFound))
    );
}

// ── assert_is_signer ─────────────────────────────────────────────────────────

#[test]
fn assert_is_signer_accepts_a_recorded_signer() {
    let f = fixture();
    let signer = Address::generate(&f.env);
    f.contract.set_signers(&Vec::from_array(&f.env, [signer.clone()]));

    assert_eq!(f.contract.try_signer_gate(&signer), Ok(Ok(())));
}

#[test]
fn assert_is_signer_rejects_an_address_that_is_not_a_signer() {
    let f = fixture();
    let signer = Address::generate(&f.env);
    f.contract.set_signers(&Vec::from_slice(&f.env, &[signer]));

    assert_eq!(
        f.contract.try_signer_gate(&f.outsider),
        Err(Ok(ContractError::Unauthorized))
    );
}

#[test]
fn assert_is_signer_reports_missing_storage_as_not_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let contract = AuthHarnessClient::new(&env, &env.register(AuthHarness, ()));
    let caller = Address::generate(&env);

    // A signer set only exists once the contract has been initialised, so the
    // absent key reads as `NotInitialized`.
    assert_eq!(
        contract.try_signer_gate(&caller),
        Err(Ok(ContractError::NotInitialized))
    );
}

// ── Cross-helper agreement ───────────────────────────────────────────────────

#[test]
fn both_admin_helpers_agree_on_whom_they_accept() {
    let f = fixture();
    assert_eq!(f.contract.try_named_admin_gate(&f.admin), Ok(Ok(())));
    assert_eq!(f.contract.admin_gate(), f.admin);

    assert_eq!(
        f.contract.try_named_admin_gate(&f.outsider),
        Err(Ok(ContractError::Unauthorized))
    );
}

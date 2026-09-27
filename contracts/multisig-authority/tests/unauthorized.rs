//! Uniform unauthorised-call rejection tests (issue #1156).
//!
//! The multisig is the one contract that takes the caller as an explicit
//! argument rather than authorising a stored address, so a caller who is not
//! recorded is rejected with a contract-level [`ContractError::Unauthorized`]
//! rather than by a host auth failure. This suite pins that every gated
//! entrypoint — admin-only and signer-gated alike — behaves the same way.

use multisig_authority::test_utils::MultisigTest;
use soroban_sdk::{
    testutils::Address as _, Address, BytesN,
};
use stellar_spend_shared::errors::ContractError;

fn hash(env: &soroban_sdk::Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

/// Every call below is made by `outsider`, who is recorded in neither the
/// administrator slot nor the signer set.
#[test]
fn add_signer_rejects_a_non_admin() {
    let t = MultisigTest::setup();
    let candidate = Address::generate(&t.env);
    assert_eq!(
        t.client().try_add_signer(&t.outsider, &candidate),
        Err(Ok(ContractError::Unauthorized))
    );
}

#[test]
fn remove_signer_rejects_a_non_admin() {
    let t = MultisigTest::setup();
    assert_eq!(
        t.client().try_remove_signer(&t.outsider, &t.signer(0)),
        Err(Ok(ContractError::Unauthorized))
    );
}

#[test]
fn set_threshold_rejects_a_non_admin() {
    let t = MultisigTest::setup();
    assert_eq!(
        t.client().try_set_threshold(&t.outsider, &3),
        Err(Ok(ContractError::Unauthorized))
    );
}

#[test]
fn set_high_value_limit_rejects_a_non_admin() {
    let t = MultisigTest::setup();
    assert_eq!(
        t.client().try_set_high_value_limit(&t.outsider, &5_000),
        Err(Ok(ContractError::Unauthorized))
    );
}

#[test]
fn upgrade_rejects_a_non_admin() {
    let t = MultisigTest::setup();
    assert_eq!(
        t.client().try_upgrade(&t.outsider, &hash(&t.env)),
        Err(Ok(ContractError::Unauthorized))
    );
}

#[test]
fn migrate_rejects_a_non_admin() {
    let t = MultisigTest::setup();
    assert_eq!(
        t.client().try_migrate(&t.outsider),
        Err(Ok(ContractError::Unauthorized))
    );
}

// ── Signer-gated entrypoints ─────────────────────────────────────────────────

#[test]
fn propose_rejects_an_address_that_is_not_a_signer() {
    let t = MultisigTest::setup();
    let target = Address::generate(&t.env);
    assert_eq!(
        t.client()
            .try_propose(&t.outsider, &t.id("p"), &t.id("d"), &target, &100),
        Err(Ok(ContractError::Unauthorized))
    );
}

#[test]
fn sign_rejects_an_address_that_is_not_a_signer() {
    let t = MultisigTest::setup();
    assert_eq!(
        t.client().try_sign(&t.outsider, &t.id("p")),
        Err(Ok(ContractError::Unauthorized))
    );
}

#[test]
fn execute_rejects_an_address_that_is_not_a_signer() {
    let t = MultisigTest::setup();
    assert_eq!(
        t.client().try_execute(&t.outsider, &t.id("p")),
        Err(Ok(ContractError::Unauthorized))
    );
}

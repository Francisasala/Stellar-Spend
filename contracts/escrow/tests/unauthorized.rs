//! Uniform unauthorised-call rejection tests (issue #1156).
//!
//! Every admin-only entrypoint on the escrow must refuse to run unless the
//! settlement authority recorded in instance storage has authorised the
//! invocation. The escrow does not take the caller as an argument — it
//! authorises whoever is stored — so "an outsider tried this" can only be
//! expressed by withholding that authority's signature.

use escrow::test_utils::EscrowTest;
use escrow::DataKey;
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, BytesN, IntoVal, Vec,
};

fn hash(env: &soroban_sdk::Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

#[test]
fn release_is_rejected_without_the_authoritys_authorisation() {
    let t = EscrowTest::setup();
    let id = t.deposit(400);
    let recipient = Address::generate(&t.env);

    t.env.mock_auths(&[]);
    assert!(t.client().try_release(&id, &recipient).is_err());

    let deposit = t.deposits_v2().get(id).expect("deposit must still exist");
    assert!(
        !deposit.released,
        "a rejected release must not mark the deposit released"
    );
}

#[test]
fn set_timeout_is_rejected_without_the_authoritys_authorisation() {
    let t = EscrowTest::setup();
    let before = t.read_storage::<u32>(&DataKey::Timeout);

    t.env.mock_auths(&[]);
    assert!(t.client().try_set_timeout(&200).is_err());

    assert_eq!(t.read_storage::<u32>(&DataKey::Timeout), before);
}

#[test]
fn upgrade_is_rejected_without_the_authoritys_authorisation() {
    let t = EscrowTest::setup();
    t.env.mock_auths(&[]);

    assert!(t.client().try_upgrade(&hash(&t.env)).is_err());
}

#[test]
fn migrate_is_rejected_without_the_authoritys_authorisation() {
    let t = EscrowTest::setup();
    t.env.mock_auths(&[]);

    // The authorisation check runs before the schema check, so this is refused
    // as an unauthorised call rather than as "already current".
    assert!(t.client().try_migrate().is_err());
}

#[test]
fn an_outsider_authorisation_does_not_standin_for_the_authority() {
    let t = EscrowTest::setup();
    let before = t.read_storage::<u32>(&DataKey::Timeout);

    // Authorise exactly one address — an outsider — for this invocation. The
    // contract then asks for the *stored* authority's signature, which has no
    // matching entry, so the host refuses the call.
    t.env.mock_auths(&[MockAuth {
        address: &t.other,
        invoke: &MockAuthInvoke {
            contract: &t.contract_id,
            fn_name: "set_timeout",
            args: Vec::from_array(&t.env, [200u32.into_val(&t.env)]),
            sub_invokes: &[],
        },
    }]);

    assert!(t.client().try_set_timeout(&200).is_err());
    assert_eq!(t.read_storage::<u32>(&DataKey::Timeout), before);
}

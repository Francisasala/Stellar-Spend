//! Uniform unauthorised-call rejection tests (issue #1156).
//!
//! Every admin-only entrypoint on the treasury must refuse to run unless the
//! administrator recorded in instance storage has authorised the invocation.
//! The treasury does not take the caller as an argument — it authorises whoever
//! is stored — so "an outsider tried this" can only be expressed by withholding
//! that administrator's signature.

use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, BytesN, IntoVal, Vec,
};
use treasury::test_utils::TreasuryTest;

fn hash(env: &soroban_sdk::Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

#[test]
fn set_fee_schedule_is_rejected_without_the_admins_authorisation() {
    let t = TreasuryTest::setup();
    let before = t.client().get_fee_schedule();

    t.env.mock_auths(&[]);
    assert!(t.client().try_set_fee_schedule(&1_000, &250).is_err());

    assert_eq!(t.client().get_fee_schedule(), before);
}

#[test]
fn remove_fee_tier_is_rejected_without_the_admins_authorisation() {
    let t = TreasuryTest::setup();
    let before = t.client().get_fee_schedule();
    let tier = before.keys().get(0).expect("fixture must have a tier");

    t.env.mock_auths(&[]);
    assert!(t.client().try_remove_fee_tier(&(tier as i128)).is_err());

    assert_eq!(t.client().get_fee_schedule(), before);
}

#[test]
fn update_treasury_is_rejected_without_the_admins_authorisation() {
    let t = TreasuryTest::setup();
    let before = t.client().get_treasury();

    t.env.mock_auths(&[]);
    let replacement = Address::generate(&t.env);
    assert!(t.client().try_update_treasury(&replacement).is_err());

    assert_eq!(t.client().get_treasury(), before);
}

#[test]
fn upgrade_is_rejected_without_the_admins_authorisation() {
    let t = TreasuryTest::setup();
    t.env.mock_auths(&[]);

    assert!(t.client().try_upgrade(&hash(&t.env)).is_err());
}

#[test]
fn migrate_is_rejected_without_the_admins_authorisation() {
    let t = TreasuryTest::setup();
    t.env.mock_auths(&[]);

    // The authorisation check runs before the schema check, so this is refused
    // as an unauthorised call rather than as "already current".
    assert!(t.client().try_migrate().is_err());
}

#[test]
fn an_outsider_authorisation_does_not_standin_for_the_admins() {
    let t = TreasuryTest::setup();
    let before = t.client().get_treasury();

    // Authorise exactly one address — an outsider — for this invocation. The
    // contract then asks for the *stored* administrator's signature, which has
    // no matching entry, so the host refuses the call.
    let replacement = Address::generate(&t.env);
    t.env.mock_auths(&[MockAuth {
        address: &t.outsider,
        invoke: &MockAuthInvoke {
            contract: &t.contract_id,
            fn_name: "update_treasury",
            args: Vec::from_array(&t.env, [replacement.clone().into_val(&t.env)]),
            sub_invokes: &[],
        },
    }]);

    assert!(t.client().try_update_treasury(&replacement).is_err());
    assert_eq!(t.client().get_treasury(), before);
}

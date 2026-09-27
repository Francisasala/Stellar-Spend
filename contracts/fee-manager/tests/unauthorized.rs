//! Uniform unauthorised-call rejection tests (issue #1156).
//!
//! Every admin-only entrypoint must refuse to run unless the administrator
//! recorded in instance storage has authorised the invocation. The fee-manager
//! does not take the caller as an argument — it authorises whoever is stored —
//! so "an outsider tried this" can only be expressed by withholding the
//! stored administrator's signature.

use fee_manager::test_utils::FeeManagerTest;
use soroban_sdk::{testutils::MockAuth, testutils::MockAuthInvoke, BytesN, IntoVal, Vec};

fn hash(env: &soroban_sdk::Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

#[test]
fn pause_is_rejected_without_the_admins_authorisation() {
    let t = FeeManagerTest::setup();
    t.env.mock_auths(&[]);

    assert!(t.client().try_pause(&t.reason("incident")).is_err());
    assert!(
        !t.client().is_paused(),
        "the circuit breaker must not trip on a rejected call"
    );
}

#[test]
fn unpause_is_rejected_without_the_admins_authorisation() {
    let t = FeeManagerTest::setup_paused();
    t.env.mock_auths(&[]);

    assert!(t.client().try_unpause().is_err());
    assert!(
        t.client().is_paused(),
        "the circuit breaker must stay tripped on a rejected call"
    );
}

#[test]
fn set_default_rate_is_rejected_without_the_admins_authorisation() {
    let t = FeeManagerTest::setup();
    let before = t.client().default_rate();
    t.env.mock_auths(&[]);

    assert!(t.client().try_set_default_rate(&250).is_err());
    assert_eq!(t.client().default_rate(), before);
}

#[test]
fn upgrade_is_rejected_without_the_admins_authorisation() {
    let t = FeeManagerTest::setup();
    t.env.mock_auths(&[]);

    assert!(t.client().try_upgrade(&hash(&t.env)).is_err());
}

#[test]
fn migrate_is_rejected_without_the_admins_authorisation() {
    let t = FeeManagerTest::setup();
    t.env.mock_auths(&[]);

    // The authorisation check runs before the schema check, so this is refused
    // as an unauthorised call rather than as "already current".
    assert!(t.client().try_migrate().is_err());
}

#[test]
fn an_outsider_authorisation_does_not_standin_for_the_admins() {
    let t = FeeManagerTest::setup();

    // Authorise exactly one address — an outsider — for this invocation. The
    // contract then asks for the *stored* administrator's signature, which has
    // no matching entry, so the host refuses the call.
    let reason = t.reason("incident");
    t.env.mock_auths(&[MockAuth {
        address: &t.outsider,
        invoke: &MockAuthInvoke {
            contract: &t.contract_id,
            fn_name: "pause",
            args: Vec::from_array(&t.env, [reason.clone().into_val(&t.env)]),
            sub_invokes: &[],
        },
    }]);

    assert!(t.client().try_pause(&reason).is_err());
    assert!(!t.client().is_paused());
}

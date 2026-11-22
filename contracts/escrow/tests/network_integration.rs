//! Integration tests exercising the escrow contract end-to-end through its
//! generated client against a local network (issue #1524).
//!
//! Each test drives the real `EscrowContractClient` through the contract's
//! public entrypoints: `deposit` → `release` / `refund`, and observes the
//! resulting `EscrowStatus` via `get_deposit`. The "local network" here is the
//! soroban test environment ([`EscrowTest::registered`]), which mirrors the
//! semantics of a local Soroban network without requiring a live rpc node.

use crate::test_utils::EscrowTest;
use crate::EscrowStatus;

// ── Deposit → release ───────────────────────────────────────────────────────

#[test]
fn integration_deposit_then_release_marks_escrow_resolved() {
    let t = EscrowTest::registered();
    let client = t.client();

    let id = client.deposit(&t.depositor, 500, &t.bridge, 0).unwrap();

    // Freshly deposited escrow is pending until released.
    assert_eq!(client.get_deposit(&id).unwrap().status, EscrowStatus::Pending);

    // Settlement authority (admin) releases the escrow.
    client.release(&id, &t.admin).unwrap();
    assert_eq!(client.get_deposit(&id).unwrap().status, EscrowStatus::Resolved);
}

// ── Deposit → refund ────────────────────────────────────────────────────────

#[test]
fn integration_deposit_then_refund_returns_escrow_cancelled() {
    let t = EscrowTest::registered();
    let client = t.client();

    let id = client.deposit(&t.depositor, 250, &t.bridge, 0).unwrap();
    assert_eq!(client.get_deposit(&id).unwrap().status, EscrowStatus::Pending);

    client.refund(&id).unwrap();
    assert_eq!(client.get_deposit(&id).unwrap().status, EscrowStatus::Cancelled);
}

// ── Settled escrows reject double settlement ────────────────────────────────

#[test]
fn integration_released_escrow_cannot_be_refunded() {
    let t = EscrowTest::registered();
    let client = t.client();

    let id = client.deposit(&t.depositor, 100, &t.bridge, 0).unwrap();
    client.release(&id, &t.admin).unwrap();
    assert_eq!(client.get_deposit(&id).unwrap().status, EscrowStatus::Resolved);

    // Refund after release is rejected (AlreadyProcessed).
    let err = client.refund(&id).unwrap_err();
    assert_eq!(err, stellar_spend_shared::errors::ContractError::AlreadyProcessed as u32);
}

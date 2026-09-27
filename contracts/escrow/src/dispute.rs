//! Refund-timeout configuration for the escrow contract.
//!
//! Extracted from `lib.rs` as part of #812 (modularisation). Contains the
//! `set_timeout` (admin) and `can_refund` (read-only) entrypoints that relate to
//! the lifecycle of a time-locked deposit.
//!
//! # Dispute records
//!
//! This module previously also carried a `DisputeHandler` that stored dispute
//! records. Nothing ever called it — no entrypoint routed to it — and its storage
//! shape could not be expressed under `#![no_std]` (string-keyed lookups via
//! `format!`) or as a `#[contracttype]` record (`Option` fields are not
//! `IntoVal`), so it never compiled. It has been removed; dispute *handling* was
//! never wired into this contract.

use soroban_sdk::{symbol_short, Env};
use stellar_spend_shared::errors::ContractError;

use crate::release::{load_deposits, require_admin};
use crate::{
    DataKey, INSTANCE_TTL_EXTEND_TO, INSTANCE_TTL_THRESHOLD, MAX_TIMEOUT_LEDGERS,
    MIN_TIMEOUT_LEDGERS,
};

/// Update the refund timeout applied to *future* deposits. Authority only.
///
/// Existing deposits keep the `timeout_ledger` fixed at creation, so lengthening
/// the timeout cannot retroactively trap funds that are already refundable.
pub fn set_timeout(env: &Env, timeout_ledgers: u32) -> Result<(), ContractError> {
    require_admin(env)?;
    if !(MIN_TIMEOUT_LEDGERS..=MAX_TIMEOUT_LEDGERS).contains(&timeout_ledgers) {
        return Err(ContractError::InvalidInput);
    }

    env.storage()
        .instance()
        .set(&DataKey::Timeout, &timeout_ledgers);
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
    env.events()
        .publish((symbol_short!("timeout"),), timeout_ledgers);
    Ok(())
}

/// Whether `refund` would currently succeed for this deposit.
///
/// Returns `false` if the deposit is already released or refunded.
pub fn can_refund(env: &Env, deposit_id: u64) -> Result<bool, ContractError> {
    let deposits = load_deposits(env)?;
    let deposit = deposits.get(deposit_id).ok_or(ContractError::NotFound)?;
    if deposit.released || deposit.refunded {
        return Ok(false);
    }
    Ok(env.ledger().sequence() >= deposit.timeout_ledger)
}

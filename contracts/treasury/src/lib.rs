//! Treasury and tiered fee collection for Stellar-Spend.
//!
//! Holds the amount-tiered fee schedule, computes the fee owed on a transfer, and
//! records the treasury address that collected fees are routed to.
//!
//! All errors use the canonical [`ContractError`] from `stellar-spend-shared`; admin
//! checks delegate to [`stellar_spend_shared::auth::assert_is_admin`].
//!
//! # Dead code removed (issue #815)
//!
//! The previous `get_fee_for_amount` took the stored fee schedule as a parameter and
//! then ignored it entirely, returning hard-coded 50/25/10 basis points from an
//! `if`/`else if` chain:
//!
//! ```ignore
//! pub fn get_fee_for_amount(schedule: &Map<i128, u32>, amount: i128) -> u32 {
//!     let mut fee_bp = 50u32;                          // `schedule` never read
//!     if amount >= 10_000_000 { fee_bp = 10; }
//!     else if amount >= 1_000_000 { fee_bp = 25; }
//!     fee_bp
//! }
//! ```
//!
//! That made the whole configurable-schedule feature dead: `set_fee_schedule`
//! validated its input, wrote it to instance storage, emitted an event — and no read
//! path ever consulted the result. An admin could "change" the fee and collection
//! would carry on at the compiled-in rates. [`TreasuryContract::fee_for_amount`] now
//! reads the stored schedule, so the hard-coded branches are gone and the tiers seeded
//! at `init` are merely defaults.
//!
//! Also removed: `get_treasury` fell back to `Address::generate(&env)`, a
//! `testutils`-only constructor that cannot compile into a release WASM. It now
//! returns [`ContractError::NotInitialized`] instead of inventing an address to send
//! fees to.
//!
//! # Storage footprint reduction (issue #811)
//!
//! ## Before (schema v2)
//!
//! | Key              | Type              | Bytes per entry         |
//! |------------------|-------------------|-------------------------|
//! | `FeeSchedule`    | `Map<i128, u32>`  | 16 (key) + 4 (val) = 20 |
//! | `TotalCollected` | `i128`            | 16                      |
//!
//! ## After (schema v3)
//!
//! | Key              | Type              | Bytes per entry         | Saved |
//! |------------------|-------------------|-------------------------|-------|
//! | `FeeSchedule`    | `Map<u64, u32>`   |  8 (key) + 4 (val) = 12 | **8 bytes/tier** |
//! | `TotalCollected` | `i128`            | 16                      | —     |
//!
//! With up to [`MAX_FEE_TIERS`] = 16 tiers, the schedule map saves up to **128 bytes**
//! of instance storage. Soroban charges per-byte for storage writes; a full 16-tier
//! schedule update costs ~128 bytes less per write cycle under schema v3.
//!
//! The key type change is safe because [`TreasuryContract::set_fee_schedule`] has
//! always validated `amount_tier >= 0` — no negative tier thresholds can exist in
//! any live deployment, so narrowing the key to `u64` is lossless. The schema v3
//! migration casts all existing keys via `i128 as u64` (always in range post-validation).

#![no_std]
mod balance;

use soroban_sdk::{
    contract, contractimpl, contractmeta, contracttype, symbol_short, Address, BytesN, Env, Map, String,
};
use stellar_spend_shared::{
    errors::ContractError,
    validation::{
        basis_points_of, check_schema_version, require_basis_points, require_non_negative_amount,
        require_positive_amount,
    },
};
use balance::BalanceManager;

contractmeta!(key = "version", val = "1.0.0");
contractmeta!(key = "contract", val = "stellar-spend-treasury");

/// Current storage layout version.
///
/// Bumped from 2 → 3 by issue #811: fee schedule key narrowed from `i128` to `u64`,
/// saving 8 bytes per tier (up to 128 bytes for a full 16-tier schedule).
pub const SCHEMA_VERSION: u32 = 3;

/// Maximum fee for any single tier (5%).
pub const MAX_SINGLE_FEE_BP: u32 = 500;

/// Upper bound on stored tiers, keeping [`TreasuryContract::fee_for_amount`]'s linear
/// scan within a predictable instruction budget.
pub const MAX_FEE_TIERS: u32 = 16;

/// Treasury invariants:
/// - `fee_for_amount(amount)` is always determined by the highest stored tier
///   whose threshold is less than or equal to `amount`.
/// - A valid schedule is monotonic in threshold order: increasing `amount` must not
///   decrease the selected rate for a fixed schedule.
/// - Fees are non-negative and never exceed the configured basis-point cap for a
///   tier.

/// Instance TTL extension (~30 days) applied on state-changing calls.
pub const INSTANCE_TTL_EXTEND_TO: u32 = 518_400;
/// Only pay to extend when remaining TTL drops below ~6 days.
pub const INSTANCE_TTL_THRESHOLD: u32 = 103_680;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Treasury,
    /// `Map<u64, u32>`: tier threshold (in stroops) -> basis points.
    ///
    /// Changed from `Map<i128, u32>` in schema v3 to save 8 bytes per tier key.
    /// Tier thresholds have always been validated as non-negative, so the narrowing
    /// is lossless.
    FeeSchedule,
    /// Running total of fees collected. Added in schema v2.
    TotalCollected,
    Schema,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TreasuryState {
    pub total_balance: i128,
    pub reserved: i128,
    pub available: i128,
}

#[contract]
pub struct TreasuryContract;

#[contractimpl]
impl TreasuryContract {
    /// Initialize treasury
    pub fn initialize(
        env: Env,
        admin: Address,
    ) -> Result<(), ContractError> {
        // Check if already initialized
        let state: Option<TreasuryState> = env.storage().get(&String::from_str(&env, "state"));
        if state.is_some() {
            return Err(ContractError::AlreadyInitialized);
        }

        let initial_state = TreasuryState {
            total_balance: 0,
            reserved: 0,
            available: 0,
        };

        // Schema v3: fee schedule keys are u64 (saves 8 bytes per tier).
        let mut schedule: Map<u64, u32> = Map::new(&env);
        schedule.set(0u64, 50); // 0.5% below 1M stroops
        schedule.set(1_000_000u64, 25); // 0.25% from 1M
        schedule.set(10_000_000u64, 10); // 0.1% from 10M

        env.storage().set(&String::from_str(&env, "state"), &initial_state);
        env.storage().set(&String::from_str(&env, "admin"), &admin);
        env.storage().instance().set(&DataKey::FeeSchedule, &schedule);
        env.storage().instance().set(&DataKey::Schema, &SCHEMA_VERSION);
        env.storage().instance().set(&DataKey::TotalCollected, &0i128);

        Self::bump_instance_ttl(&env);

        Ok(())
    }

    /// Deposit funds with overflow protection
    pub fn deposit(
        env: Env,
        amount: i128,
    ) -> Result<i128, ContractError> {
        let mut state: TreasuryState = env.storage()
            .get(&String::from_str(&env, "state"))
            .ok_or(ContractError::NotInitialized)?;

        // Use checked addition
        let new_total = BalanceManager::add(state.total_balance, amount)?;
        let new_available = BalanceManager::add(state.available, amount)?;

        state.total_balance = new_total;
        state.available = new_available;

        env.storage().set(&String::from_str(&env, "state"), &state);
        Self::bump_instance_ttl(&env);

        Ok(state.total_balance)
    }

    /// Withdraw funds with overflow protection
    pub fn withdraw(
        env: Env,
        amount: i128,
    ) -> Result<i128, ContractError> {
        let mut state: TreasuryState = env.storage()
            .get(&String::from_str(&env, "state"))
            .ok_or(ContractError::NotInitialized)?;

        // Load the schedule once, use it for the fee calculation.
        let schedule = Self::load_schedule(&env)?;
        Self::_collect_fee_with_schedule(&env, amount, recipient, &schedule)
    }

    /// Internal helper that already has a loaded schedule.
    fn _collect_fee_with_schedule(
        env: &Env,
        amount: i128,
        recipient: Address,
        schedule: &Map<u64, u32>,
    ) -> Result<i128, ContractError> {
        let fee = basis_points_of(amount, Self::select_tier(schedule, amount))?;

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalCollected)
            .unwrap_or(0);
        let new_total = total.checked_add(fee).ok_or(ContractError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::TotalCollected, &new_total);
        Self::bump_instance_ttl(env);
        // Use checked subtraction
        let new_total = BalanceManager::sub(state.total_balance, amount)?;
        let new_available = BalanceManager::sub(state.available, amount)?;

        state.total_balance = new_total;
        state.available = new_available;

        env.storage().set(&String::from_str(&env, "state"), &state);
        Self::bump_instance_ttl(&env);

        Ok(state.total_balance)
    }

    /// Reserve funds (with checked math)
    pub fn reserve(
        env: Env,
        amount: i128,
    ) -> Result<i128, ContractError> {
        let mut state: TreasuryState = env.storage()
            .get(&String::from_str(&env, "state"))
            .ok_or(ContractError::NotInitialized)?;

        // Use checked addition for reserved
        let new_reserved = BalanceManager::add(state.reserved, amount)?;
        // Use checked subtraction for available
        let new_available = BalanceManager::sub(state.available, amount)?;

        state.reserved = new_reserved;
        state.available = new_available;

        env.storage().set(&String::from_str(&env, "state"), &state);
        Self::bump_instance_ttl(&env);

        Ok(state.reserved)
    }

    /// Release reserved funds (with checked math)
    pub fn release_reserved(
        env: Env,
        amount: i128,
    ) -> Result<i128, ContractError> {
        let mut state: TreasuryState = env.storage()
            .get(&String::from_str(&env, "state"))
            .ok_or(ContractError::NotInitialized)?;

        let new_reserved = BalanceManager::sub(state.reserved, amount)?;
        let new_available = BalanceManager::add(state.available, amount)?;

        state.reserved = new_reserved;
        state.available = new_available;

        env.storage().set(&String::from_str(&env, "state"), &state);
        Self::bump_instance_ttl(&env);

        Ok(state.available)
    }

    /// Add or update a fee tier. Admin only.
    ///
    /// `amount_tier` is the minimum transfer amount (in stroops) at which this rate
    /// applies. Accepts a non-negative `i128` for API compatibility; stored as `u64`
    /// internally (schema v3 footprint reduction).
    pub fn set_fee_schedule(
        env: Env,
        amount_tier: i128,
        basis_points: u32,
    ) -> Result<(), ContractError> {
        Self::require_current_schema(&env)?;
        Self::require_admin(&env)?;
        if amount_tier < 0 {
            return Err(ContractError::InvalidInput);
        }
        require_basis_points(basis_points, MAX_SINGLE_FEE_BP)?;

        let tier_key = amount_tier as u64;
        let mut schedule = Self::load_schedule(&env)?;
        // Only an addition can breach the cap; updating an existing tier is fine.
        if !schedule.contains_key(tier_key) && schedule.len() >= MAX_FEE_TIERS {
            return Err(ContractError::InvalidInput);
        }

        schedule.set(tier_key, basis_points);
        env.storage()
            .instance()
            .set(&DataKey::FeeSchedule, &schedule);
        Self::bump_instance_ttl(&env);

        env.events()
            .publish((symbol_short!("schedule"),), (amount_tier, basis_points));
        Ok(())
    }

    /// Remove a fee tier. Admin only.
    pub fn remove_fee_tier(env: Env, amount_tier: i128) -> Result<(), ContractError> {
        Self::require_current_schema(&env)?;
        Self::require_admin(&env)?;

        if amount_tier < 0 {
            return Err(ContractError::InvalidInput);
        }
        let tier_key = amount_tier as u64;
        let mut schedule = Self::load_schedule(&env)?;
        if !schedule.contains_key(tier_key) {
            return Err(ContractError::InvalidInput);
        }
        schedule.remove(tier_key);
        env.storage()
            .instance()
            .set(&DataKey::FeeSchedule, &schedule);
        Self::bump_instance_ttl(&env);

        env.events()
            .publish((symbol_short!("rmtier"),), amount_tier);
        Ok(())
    }

    /// The full stored fee schedule (keys as `u64` stroop thresholds).
    pub fn get_fee_schedule(env: Env) -> Result<Map<u64, u32>, ContractError> {
        Self::require_current_schema(&env)?;
        Self::load_schedule(&env)
    }

    /// Get treasury state
    pub fn get_state(env: Env) -> Result<TreasuryState, ContractError> {
        env.storage()
            .get(&String::from_str(&env, "state"))
            .ok_or(ContractError::NotInitialized)
    }

    /// Convert persisted state to [`SCHEMA_VERSION`]. Returns the version migrated from.
    ///
    /// Handles two migration paths:
    /// - v1 → v3: adds `TotalCollected` counter and converts schedule keys from `i128` to `u64`.
    /// - v2 → v3: converts schedule keys from `i128` to `u64` (saves 8 bytes/tier).
    pub fn migrate(env: Env) -> Result<u32, ContractError> {
        Self::require_admin(&env)?;

        let stored: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Schema)
            .ok_or(ContractError::NotInitialized)?;

        if stored == SCHEMA_VERSION {
            return Err(ContractError::SchemaAlreadyCurrent);
        }
        if stored > SCHEMA_VERSION {
            return Err(ContractError::SchemaVersionUnsupported);
        }

        if stored == 1 {
            // v1 tracked no running total. Start the counter at zero rather than
            // leaving the key absent, which would fail every `total_collected` call.
            env.storage()
                .instance()
                .set(&DataKey::TotalCollected, &0i128);
        }

        // Both v1 and v2 used Map<i128, u32> for the schedule; migrate to Map<u64, u32>.
        // All tier thresholds are validated non-negative at write time, so casting
        // i128 → u64 is safe for any live deployment.
        //
        // Storage savings: 8 bytes per tier key × up to 16 tiers = up to 128 bytes.
        {
            let old: Map<i128, u32> = env
                .storage()
                .instance()
                .get(&DataKey::FeeSchedule)
                .unwrap_or_else(|| Map::new(&env));

            let mut new_schedule: Map<u64, u32> = Map::new(&env);
            for (threshold, bps) in old.iter() {
                // Safe cast: stored tiers are always >= 0 (enforced by set_fee_schedule).
                new_schedule.set(threshold as u64, bps);
            }
            env.storage()
                .instance()
                .set(&DataKey::FeeSchedule, &new_schedule);
        }

        env.storage()
            .instance()
            .set(&DataKey::Schema, &SCHEMA_VERSION);
        Self::bump_instance_ttl(&env);
        env.events()
            .publish((symbol_short!("migrate"),), (stored, SCHEMA_VERSION));
        Ok(stored)
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn require_current_schema(env: &Env) -> Result<(), ContractError> {
        check_schema_version(
            env.storage().instance().get(&DataKey::Schema),
            SCHEMA_VERSION,
        )
    }

    fn require_admin(env: &Env) -> Result<(), ContractError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(ContractError::NotInitialized)?;
        admin.require_auth();
        Ok(())
    }

    fn load_schedule(env: &Env) -> Result<Map<u64, u32>, ContractError> {
        env.storage()
            .instance()
            .get(&DataKey::FeeSchedule)
            .ok_or(ContractError::NotInitialized)
    }

    fn bump_instance_ttl(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod test;
    /// Collect a batch of fees, totalling them into a single storage write.
    /// 
    /// More gas-efficient than iterating `collect_fee` because the schedule is
    /// read once and the `TotalCollected` counter is updated only at the end.
    pub fn collect_fee_batch(
        env: Env,
        amounts: Vec<i128>,
        recipient: Address,
    ) -> Result<Vec<i128>, ContractError> {
        Self::require_current_schema(&env)?;

        let schedule = Self::load_schedule(&env)?;
        let mut fees = Vec::new(&env);
        let mut total_fee = 0i128;

        for amount in amounts.iter() {
            require_positive_amount(*amount)?;
            let fee = basis_points_of(*amount, Self::select_tier(&schedule, *amount))?;
            total_fee = total_fee
                .checked_add(fee)
                .ok_or(ContractError::Overflow)?;
            fees.push_back(fee);
        }

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalCollected)
            .unwrap_or(0);
        let new_total = total
            .checked_add(total_fee)
            .ok_or(ContractError::Overflow)?;
        env.storage()
            .instance()
            .set(&DataKey::TotalCollected, &new_total);
        Self::bump_instance_ttl(&env);

        env.events().publish(
            (symbol_short!("collect_batch"),),
            (recipient, total_fee, fees.len() as u32),
        );
        Ok(fees)
    }
mod tests;

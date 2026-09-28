use soroban_sdk::{Address, Env, Symbol, Vec, String};

/// Shared event topics
pub mod topics {
    use soroban_sdk::symbol_short;

    // Admin events
    pub const ADMIN_INITIALIZED: Symbol = symbol_short!("admin_init");
    pub const ADMIN_UPDATED: Symbol = symbol_short!("admin_upd");
    pub const ADMIN_REMOVED: Symbol = symbol_short!("admin_rem");

    // Escrow events
    pub const ESCROW_CREATED: Symbol = symbol_short!("escrow_crt");
    pub const ESCROW_FUNDED: Symbol = symbol_short!("escrow_fnd");
    pub const ESCROW_RELEASED: Symbol = symbol_short!("escrow_rel");
    pub const ESCROW_REFUNDED: Symbol = symbol_short!("escrow_ref");
    pub const ESCROW_CANCELLED: Symbol = symbol_short!("escrow_can");

    // Dispute events
    pub const DISPUTE_CREATED: Symbol = symbol_short!("dispute_crt");
    pub const DISPUTE_RESOLVED: Symbol = symbol_short!("dispute_res");

    // Fee events
    pub const FEE_SET: Symbol = symbol_short!("fee_set");
    pub const FEE_COLLECTED: Symbol = symbol_short!("fee_col");
    pub const FEE_UPDATED: Symbol = symbol_short!("fee_upd");

    // Multisig events
    pub const MULTISIG_SUBMITTED: Symbol = symbol_short!("msig_sub");
    pub const MULTISIG_APPROVED: Symbol = symbol_short!("msig_app");
    pub const MULTISIG_EXECUTED: Symbol = symbol_short!("msig_exec");
    pub const MULTISIG_REJECTED: Symbol = symbol_short!("msig_rej");

    // Treasury events
    pub const TREASURY_DEPOSIT: Symbol = symbol_short!("treasury_dep");
    pub const TREASURY_WITHDRAWAL: Symbol = symbol_short!("treasury_wit");
    pub const TREASURY_BALANCE: Symbol = symbol_short!("treasury_bal");

    // Shared events
    pub const CONTRACT_PAUSED: Symbol = symbol_short!("contract_pau");
    pub const CONTRACT_UNPAUSED: Symbol = symbol_short!("contract_unp");
    pub const CONTRACT_UPGRADED: Symbol = symbol_short!("contract_upg");

    // Error events
    pub const ERROR_OCCURRED: Symbol = symbol_short!("error_occ");
}

/// Shared event format structure
pub struct EventFormat;

impl EventFormat {
    /// Emit an event with standard format
    pub fn emit(
        env: &Env,
        topic: Symbol,
        data: impl soroban_sdk::IntoVal<Env, Vec<Val>>,
    ) {
        env.events().publish((topic, "v1"), data);
    }

    /// Emit an event with standard format and version
    pub fn emit_with_version(
        env: &Env,
        topic: Symbol,
        version: &str,
        data: impl soroban_sdk::IntoVal<Env, Vec<Val>>,
    ) {
        env.events().publish((topic, Symbol::new(env, version)), data);
    }

    /// Emit an admin initialized event
    pub fn emit_admin_initialized(env: &Env, admin: Address) {
        Self::emit(env, topics::ADMIN_INITIALIZED, (admin, env.ledger().timestamp()));
    }

    /// Emit an escrow created event
    pub fn emit_escrow_created(
        env: &Env,
        escrow_id: u64,
        buyer: Address,
        seller: Address,
        amount: i128,
    ) {
        Self::emit(env, topics::ESCROW_CREATED, (escrow_id, buyer, seller, amount, env.ledger().timestamp()));
    }

    /// Emit an escrow funded event
    pub fn emit_escrow_funded(
        env: &Env,
        escrow_id: u64,
        funder: Address,
        amount: i128,
    ) {
        Self::emit(env, topics::ESCROW_FUNDED, (escrow_id, funder, amount, env.ledger().timestamp()));
    }

    /// Emit an escrow released event
    pub fn emit_escrow_released(
        env: &Env,
        escrow_id: u64,
        recipient: Address,
        amount: i128,
    ) {
        Self::emit(env, topics::ESCROW_RELEASED, (escrow_id, recipient, amount, env.ledger().timestamp()));
    }

    /// Emit an escrow refunded event
    pub fn emit_escrow_refunded(
        env: &Env,
        escrow_id: u64,
        recipient: Address,
        amount: i128,
    ) {
        Self::emit(env, topics::ESCROW_REFUNDED, (escrow_id, recipient, amount, env.ledger().timestamp()));
    }

    /// Emit a dispute created event
    pub fn emit_dispute_created(
        env: &Env,
        escrow_id: u64,
        initiator: Address,
        respondent: Address,
        reason: String,
    ) {
        Self::emit(env, topics::DISPUTE_CREATED, (escrow_id, initiator, respondent, reason, env.ledger().timestamp()));
    }

    /// Emit a dispute resolved event
    pub fn emit_dispute_resolved(
        env: &Env,
        escrow_id: u64,
        resolver: Address,
        outcome: String,
    ) {
        Self::emit(env, topics::DISPUTE_RESOLVED, (escrow_id, resolver, outcome, env.ledger().timestamp()));
    }

    /// Emit a fee set event
    pub fn emit_fee_set(
        env: &Env,
        fee_type: String,
        fee_rate: i128,
    ) {
        Self::emit(env, topics::FEE_SET, (fee_type, fee_rate, env.ledger().timestamp()));
    }

    /// Emit a fee collected event
    pub fn emit_fee_collected(
        env: &Env,
        fee_type: String,
        amount: i128,
        recipient: Address,
    ) {
        Self::emit(env, topics::FEE_COLLECTED, (fee_type, amount, recipient, env.ledger().timestamp()));
    }

    /// Emit a multisig submitted event
    pub fn emit_multisig_submitted(
        env: &Env,
        proposal_id: u64,
        proposer: Address,
        description: String,
    ) {
        Self::emit(env, topics::MULTISIG_SUBMITTED, (proposal_id, proposer, description, env.ledger().timestamp()));
    }

    /// Emit a multisig approved event
    pub fn emit_multisig_approved(
        env: &Env,
        proposal_id: u64,
        approver: Address,
    ) {
        Self::emit(env, topics::MULTISIG_APPROVED, (proposal_id, approver, env.ledger().timestamp()));
    }

    /// Emit a multisig executed event
    pub fn emit_multisig_executed(
        env: &Env,
        proposal_id: u64,
        executor: Address,
    ) {
        Self::emit(env, topics::MULTISIG_EXECUTED, (proposal_id, executor, env.ledger().timestamp()));
    }

    /// Emit a treasury deposit event
    pub fn emit_treasury_deposit(
        env: &Env,
        depositor: Address,
        amount: i128,
        asset: String,
    ) {
        Self::emit(env, topics::TREASURY_DEPOSIT, (depositor, amount, asset, env.ledger().timestamp()));
    }

    /// Emit a treasury withdrawal event
    pub fn emit_treasury_withdrawal(
        env: &Env,
        recipient: Address,
        amount: i128,
        asset: String,
    ) {
        Self::emit(env, topics::TREASURY_WITHDRAWAL, (recipient, amount, asset, env.ledger().timestamp()));
    }

    /// Emit a contract paused event
    pub fn emit_contract_paused(
        env: &Env,
        caller: Address,
    ) {
        Self::emit(env, topics::CONTRACT_PAUSED, (caller, env.ledger().timestamp()));
    }

    /// Emit a contract unpaused event
    pub fn emit_contract_unpaused(
        env: &Env,
        caller: Address,
    ) {
        Self::emit(env, topics::CONTRACT_UNPAUSED, (caller, env.ledger().timestamp()));
    }

    /// Emit a contract upgraded event
    pub fn emit_contract_upgraded(
        env: &Env,
        new_wasm_hash: Vec<u8>,
    ) {
        Self::emit(env, topics::CONTRACT_UPGRADED, (new_wasm_hash, env.ledger().timestamp()));
    }

    /// Emit an error event
    pub fn emit_error(
        env: &Env,
        error_code: u32,
        error_message: String,
        context: String,
    ) {
        Self::emit(env, topics::ERROR_OCCURRED, (error_code, error_message, context, env.ledger().timestamp()));
    }
}

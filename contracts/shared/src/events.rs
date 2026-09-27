use soroban_sdk::{Address, Env, Symbol, Vec, String, Val};

/// Shared event topics
pub mod topics {
    use soroban_sdk::{symbol_short, Symbol};

    // Admin events
    pub const ADMIN_INIT: Symbol = symbol_short!("adminini");
    pub const ADMIN_UPDT: Symbol = symbol_short!("adminupd");
    pub const ADMIN_RMV: Symbol = symbol_short!("adminrmv");

    // Escrow events
    pub const ESCROW_CRT: Symbol = symbol_short!("escrowcr");
    pub const ESCROW_FND: Symbol = symbol_short!("escrowfn");
    pub const ESCROW_REL: Symbol = symbol_short!("escrowrl");
    pub const ESCROW_REF: Symbol = symbol_short!("escrowrf");
    pub const ESCROW_CAN: Symbol = symbol_short!("escrowca");

    // Dispute events
    pub const DISPUTE_CRT: Symbol = symbol_short!("dscrt");
    pub const DISPUTE_RES: Symbol = symbol_short!("dsres");

    // Fee events
    pub const FEE_SET: Symbol = symbol_short!("feeset");
    pub const FEE_COL: Symbol = symbol_short!("feecol");
    pub const FEE_UPDT: Symbol = symbol_short!("feeupd");

    // Multisig events
    pub const MSIG_SUB: Symbol = symbol_short!("msigsub");
    pub const MSIG_APP: Symbol = symbol_short!("msigapp");
    pub const MSIG_EXEC: Symbol = symbol_short!("msigex");
    pub const MSIG_REJ: Symbol = symbol_short!("msigrej");

    // Treasury events
    pub const TREASURY_D: Symbol = symbol_short!("trdsub");
    pub const TREASURY_W: Symbol = symbol_short!("trdwth");
    pub const TREASURY_B: Symbol = symbol_short!("trdbal");

    // Shared events
    pub const CONTRACT_PAU: Symbol = symbol_short!("cnpause");
    pub const CONTRACT_UNP: Symbol = symbol_short!("cnunpa");
    pub const CONTRACT_UPG: Symbol = symbol_short!("cnupgd");

    // Error events
    pub const ERROR_OCC: Symbol = symbol_short!("errocc");
}

/// Shared event format structure
pub struct EventFormat;

impl EventFormat {
    /// Emit an event with standard format
    pub fn emit(
        env: &Env,
        topic: Symbol,
        data: impl soroban_sdk::IntoVal<Env, Val>,
    ) {
        env.events().publish((topic, "v1"), data);
    }

    /// Emit an event with standard format and version
    pub fn emit_with_version(
        env: &Env,
        topic: Symbol,
        version: &str,
        data: impl soroban_sdk::IntoVal<Env, Val>,
    ) {
        env.events().publish((topic, Symbol::new(env, version)), data);
    }

    /// Emit an admin initialized event
    pub fn emit_admin_initialized(env: &Env, admin: Address) {
        Self::emit(env, topics::ADMIN_INIT, (admin, env.ledger().timestamp()));
    }

    /// Emit an escrow created event
    pub fn emit_escrow_created(
        env: &Env,
        escrow_id: u64,
        buyer: Address,
        seller: Address,
        amount: i128,
    ) {
        Self::emit(env, topics::ESCROW_CRT, (escrow_id, buyer, seller, amount, env.ledger().timestamp()));
    }

    /// Emit an escrow funded event
    pub fn emit_escrow_funded(
        env: &Env,
        escrow_id: u64,
        funder: Address,
        amount: i128,
    ) {
        Self::emit(env, topics::ESCROW_FND, (escrow_id, funder, amount, env.ledger().timestamp()));
    }

    /// Emit an escrow released event
    pub fn emit_escrow_released(
        env: &Env,
        escrow_id: u64,
        recipient: Address,
        amount: i128,
    ) {
        Self::emit(env, topics::ESCROW_REL, (escrow_id, recipient, amount, env.ledger().timestamp()));
    }

    /// Emit an escrow refunded event
    pub fn emit_escrow_refunded(
        env: &Env,
        escrow_id: u64,
        recipient: Address,
        amount: i128,
    ) {
        Self::emit(env, topics::ESCROW_REF, (escrow_id, recipient, amount, env.ledger().timestamp()));
    }

    /// Emit a dispute created event
    pub fn emit_dispute_created(
        env: &Env,
        escrow_id: u64,
        initiator: Address,
        respondent: Address,
        reason: String,
    ) {
        Self::emit(env, topics::DISPUTE_CRT, (escrow_id, initiator, respondent, reason, env.ledger().timestamp()));
    }

    /// Emit a dispute resolved event
    pub fn emit_dispute_resolved(
        env: &Env,
        escrow_id: u64,
        resolver: Address,
        outcome: String,
    ) {
        Self::emit(env, topics::DISPUTE_RES, (escrow_id, resolver, outcome, env.ledger().timestamp()));
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
        Self::emit(env, topics::FEE_COL, (fee_type, amount, recipient, env.ledger().timestamp()));
    }

    /// Emit a multisig submitted event
    pub fn emit_multisig_submitted(
        env: &Env,
        proposal_id: u64,
        proposer: Address,
        description: String,
    ) {
        Self::emit(env, topics::MSIG_SUB, (proposal_id, proposer, description, env.ledger().timestamp()));
    }

    /// Emit a multisig approved event
    pub fn emit_multisig_approved(
        env: &Env,
        proposal_id: u64,
        approver: Address,
    ) {
        Self::emit(env, topics::MSIG_APP, (proposal_id, approver, env.ledger().timestamp()));
    }

    /// Emit a multisig executed event
    pub fn emit_multisig_executed(
        env: &Env,
        proposal_id: u64,
        executor: Address,
    ) {
        Self::emit(env, topics::MSIG_EXEC, (proposal_id, executor, env.ledger().timestamp()));
    }

    /// Emit a treasury deposit event
    pub fn emit_treasury_deposit(
        env: &Env,
        depositor: Address,
        amount: i128,
        asset: String,
    ) {
        Self::emit(env, topics::TREASURY_D, (depositor, amount, asset, env.ledger().timestamp()));
    }

    /// Emit a treasury withdrawal event
    pub fn emit_treasury_withdrawal(
        env: &Env,
        recipient: Address,
        amount: i128,
        asset: String,
    ) {
        Self::emit(env, topics::TREASURY_W, (recipient, amount, asset, env.ledger().timestamp()));
    }

    /// Emit a contract paused event
    pub fn emit_contract_paused(
        env: &Env,
        caller: Address,
    ) {
        Self::emit(env, topics::CONTRACT_PAU, (caller, env.ledger().timestamp()));
    }

    /// Emit a contract unpaused event
    pub fn emit_contract_unpaused(
        env: &Env,
        caller: Address,
    ) {
        Self::emit(env, topics::CONTRACT_UNP, (caller, env.ledger().timestamp()));
    }

    /// Emit a contract upgraded event
    pub fn emit_contract_upgraded(
        env: &Env,
        new_wasm_hash: Vec<u8>,
    ) {
        Self::emit(env, topics::CONTRACT_UPG, (new_wasm_hash, env.ledger().timestamp()));
    }

    /// Emit an error event
    pub fn emit_error(
        env: &Env,
        error_code: u32,
        error_message: String,
        context: String,
    ) {
        Self::emit(env, topics::ERROR_OCC, (error_code, error_message, context, env.ledger().timestamp()));
    }
}

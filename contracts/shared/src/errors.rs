use soroban_sdk::contracttype;

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ContractError {
    Unauthorized = 1,
    NotAdmin = 2,
    InvalidSigner = 3,
    InsufficientPermissions = 4,
    AlreadyInitialized = 5,
    NotInitialized = 6,
    InvalidInput = 7,
    NotFound = 8,
    AlreadyExists = 9,
    AlreadyProcessed = 10,
    Expired = 11,
    BelowThreshold = 12,
    Paused = 13,
    Reentrant = 14,
    Overflow = 15,
    ContractFault = 16,
    InvalidAmount = 17,
    MigrationRequired = 18,
    SchemaVersionUnsupported = 19,
    SchemaAlreadyCurrent = 20,
    ArithmeticOverflow = 21,
    InsufficientBalance = 22,
}

impl ContractError {
    /// Map a Soroban contract error code back to its variant.
    ///
    /// Returns `None` for codes that this enum does not define, and for errors
    /// raised outside the contract domain (storage, context, Wasm VM, ...).
    pub const fn from_code(code: u32) -> Option<Self> {
        Some(match code {
            1 => Self::Unauthorized,
            2 => Self::NotAdmin,
            3 => Self::InvalidSigner,
            4 => Self::InsufficientPermissions,
            5 => Self::AlreadyInitialized,
            6 => Self::NotInitialized,
            7 => Self::InvalidInput,
            8 => Self::NotFound,
            9 => Self::AlreadyExists,
            10 => Self::AlreadyProcessed,
            11 => Self::Expired,
            12 => Self::BelowThreshold,
            13 => Self::Paused,
            14 => Self::Reentrant,
            15 => Self::Overflow,
            16 => Self::ContractFault,
            17 => Self::InvalidAmount,
            18 => Self::MigrationRequired,
            19 => Self::SchemaVersionUnsupported,
            20 => Self::SchemaAlreadyCurrent,
            21 => Self::ArithmeticOverflow,
            22 => Self::InsufficientBalance,
            _ => return None,
        })
    }
}

impl From<soroban_sdk::Error> for ContractError {
    fn from(err: soroban_sdk::Error) -> Self {
        use soroban_sdk::xdr::ScErrorType;
        if !err.is_type(ScErrorType::Contract) {
            return Self::ContractFault;
        }
        Self::from_code(err.get_code()).unwrap_or(Self::ContractFault)
    }
}

impl From<ContractError> for soroban_sdk::Error {
    fn from(err: ContractError) -> Self {
        soroban_sdk::Error::from_contract_error(err as u32)
    }
}

impl<'a> From<&'a ContractError> for soroban_sdk::Error {
    fn from(err: &'a ContractError) -> Self {
        soroban_sdk::Error::from_contract_error(*err as u32)
    }
}

use soroban_sdk::contracttype;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SharedError {
    Unauthorized = 1,
    NotAdmin = 2,
    InvalidSigner = 3,
    InsufficientPermissions = 4,
    AlreadyInitialized = 5,
    NotInitialized = 6,
    InvalidInput = 7,
    NotFound = 8,
    AlreadyExists = 9,
}

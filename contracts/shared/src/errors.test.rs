#[cfg(test)]
mod tests {
    use crate::errors::ContractError;

    #[test]
    fn error_codes_are_stable() {
        // Stability guarantee: these numeric codes must never change once deployed.
        // Add new variants at the end; never reorder or remove existing ones.
        assert_eq!(ContractError::Unauthorized as u32, 1);
        assert_eq!(ContractError::InvalidAmount as u32, 2);
        assert_eq!(ContractError::NotFound as u32, 3);
        assert_eq!(ContractError::AlreadyProcessed as u32, 4);
        assert_eq!(ContractError::Expired as u32, 5);
        assert_eq!(ContractError::BelowThreshold as u32, 6);
        assert_eq!(ContractError::Paused as u32, 7);
        assert_eq!(ContractError::Reentrant as u32, 8);
        assert_eq!(ContractError::Overflow as u32, 9);
        assert_eq!(ContractError::ContractFault as u32, 10);
        assert_eq!(ContractError::AlreadyInitialized as u32, 11);
        assert_eq!(ContractError::NotInitialized as u32, 12);
        assert_eq!(ContractError::MigrationRequired as u32, 13);
        assert_eq!(ContractError::SchemaVersionUnsupported as u32, 14);
        assert_eq!(ContractError::SchemaAlreadyCurrent as u32, 15);
        assert_eq!(ContractError::InvalidInput as u32, 16);
    }

    #[test]
    fn error_types_are_copy_clone() {
        // Verify that ContractError can be freely copied and cloned
        let err1 = ContractError::Unauthorized;
        let err2 = err1;
        let err3 = err1.clone();
        assert_eq!(err1, err2);
        assert_eq!(err1, err3);
    }
}

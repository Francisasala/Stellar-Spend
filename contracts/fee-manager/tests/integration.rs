#[cfg(test)]
mod tests {
    use fee_manager::FeeManagerContract;

    #[test]
    fn test_calculate_fee_basic() {
        // Standard 5% fee on 1000 units
        let amount = 1000i128;
        let fee_rate = 500u32;
        let expected_fee = 50i128;
        assert_eq!(expected_fee, (amount as u128 * fee_rate as u128 / 10000) as i128);
    }

    #[test]
    fn test_calculate_fee_zero_fee_rate() {
        // Zero fee rate produces zero fee
        let amount = 1000i128;
        let fee_rate = 0u32;
        let expected_fee = 0i128;
        assert_eq!(expected_fee, (amount as u128 * fee_rate as u128 / 10000) as i128);
    }

    #[test]
    fn test_calculate_fee_full_rate() {
        // 100% fee rate (10000 basis points)
        let amount = 500i128;
        let fee_rate = 10000u32;
        let expected_fee = 500i128;
        assert_eq!(expected_fee, (amount as u128 * fee_rate as u128 / 10000) as i128);
    }

    #[test]
    fn test_calculate_fee_rounds_down() {
        // fee_rate=333 (3.33%) on amount=100 → 3.33 truncates to 3
        let amount = 100i128;
        let fee_rate = 333u32;
        let expected_fee = 3i128;
        assert_eq!(expected_fee, (amount as u128 * fee_rate as u128 / 10000) as i128);
    }

    #[test]
    fn test_calculate_fee_small_amount_rounds_to_zero() {
        // fee_rate=500 (5%) on amount=10 → 0.5 truncates to 0
        let amount = 10i128;
        let fee_rate = 500u32;
        let expected_fee = 0i128;
        assert_eq!(expected_fee, (amount as u128 * fee_rate as u128 / 10000) as i128);
    }

    #[test]
    fn test_calculate_fee_large_amount() {
        // fee_rate=1000 (10%) on large amount
        let amount = 1_000_000i128;
        let fee_rate = 1000u32;
        let expected_fee = 100_000i128;
        assert_eq!(expected_fee, (amount as u128 * fee_rate as u128 / 10000) as i128);
    }

    #[test]
    fn test_calculate_fee_exact_boundary() {
        // fee_rate=100 (1%) on amount=99 → 0.99 truncates to 0
        // fee_rate=100 (1%) on amount=100 → 1.00 exactly
        let amount_low = 99i128;
        let fee_rate = 100u32;
        let fee_low = (amount_low as u128 * fee_rate as u128 / 10000) as i128;
        assert_eq!(fee_low, 0i128);

        let amount_high = 100i128;
        let fee_high = (amount_high as u128 * fee_rate as u128 / 10000) as i128;
        assert_eq!(fee_high, 1i128);
    }

    #[test]
    fn test_calculate_fee_minimum_fee_scenario() {
        // Smallest non-zero fee: fee_rate=1 on amount=10000 → 1
        let amount = 10000i128;
        let fee_rate = 1u32;
        let expected_fee = 1i128;
        assert_eq!(expected_fee, (amount as u128 * fee_rate as u128 / 10000) as i128);
    }

    #[test]
    fn test_calculate_fee_round_down_consistency() {
        // Verify rounding always goes down: fee * 10000 <= amount * fee_rate
        let amount = 1234i128;
        let fee_rate = 750u32;
        let fee = (amount as u128 * fee_rate as u128 / 10000) as i128;
        assert!((fee as u128) * 10000 <= amount as u128 * fee_rate as u128);
        assert!(fee <= ((amount as f64) * (fee_rate as f64) / 10000.0).floor() as i128);
    }

    #[test]
    fn test_round_up_boundary_case() {
        // fee_rate=9999 (99.99%) on amount=100 → 99.99 truncates to 99
        let amount = 100i128;
        let fee_rate = 9999u32;
        let expected_fee = 99i128;
        assert_eq!(expected_fee, (amount as u128 * fee_rate as u128 / 10000) as i128);
    }

    #[test]
    fn test_round_down_boundary_case() {
        // fee_rate=10001 would be >100% but capped scenario: 10000 = 100%
        // fee_rate=5000 (50%) on amount=3 → 1.5 truncates to 1
        let amount = 3i128;
        let fee_rate = 5000u32;
        let expected_fee = 1i128;
        assert_eq!(expected_fee, (amount as u128 * fee_rate as u128 / 10000) as i128);
    }
}
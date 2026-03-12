use crate::errors::VaultError;
use crate::constants::PRECISION;

/// Calculate exchange rate: EURC per pbEURC, scaled by PRECISION.
/// Returns PRECISION (1:1) when supply is 0.
pub fn calculate_exchange_rate(
    total_eurc: u64,
    total_supply: u64,
) -> Result<u128, anchor_lang::error::Error> {
    if total_supply == 0 {
        return Ok(PRECISION);
    }

    (total_eurc as u128)
        .checked_mul(PRECISION)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(total_supply as u128)
        .ok_or_else(|| VaultError::MathOverflow.into())
}

/// Convert EURC amount to pbEURC shares at the given exchange rate.
/// Rounds DOWN to protect the vault (user gets slightly fewer shares).
pub fn eurc_to_shares(
    eurc_amount: u64,
    exchange_rate: u128,
) -> Result<u64, anchor_lang::error::Error> {
    if exchange_rate == 0 {
        return Err(VaultError::MathOverflow.into());
    }

    let shares = (eurc_amount as u128)
        .checked_mul(PRECISION)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(exchange_rate)
        .ok_or(VaultError::MathOverflow)?;

    u64::try_from(shares).map_err(|_| VaultError::MathOverflow.into())
}

/// Convert pbEURC shares to EURC amount at the given exchange rate.
/// Rounds DOWN (user gets slightly less EURC).
pub fn shares_to_eurc(
    shares: u64,
    exchange_rate: u128,
) -> Result<u64, anchor_lang::error::Error> {
    let eurc = (shares as u128)
        .checked_mul(exchange_rate)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(PRECISION)
        .ok_or(VaultError::MathOverflow)?;

    u64::try_from(eurc).map_err(|_| VaultError::MathOverflow.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_exchange_rate() {
        let rate = calculate_exchange_rate(0, 0).unwrap();
        assert_eq!(rate, PRECISION); // 1:1 when empty
    }

    #[test]
    fn test_exchange_rate_1_to_1() {
        // 100 EURC, 100 pbEURC supply → rate = 1.0
        let rate = calculate_exchange_rate(100_000_000, 100_000_000).unwrap();
        assert_eq!(rate, PRECISION);
    }

    #[test]
    fn test_exchange_rate_grows_with_rewards() {
        // 110 EURC, 100 pbEURC supply → rate = 1.1
        let rate = calculate_exchange_rate(110_000_000, 100_000_000).unwrap();
        assert_eq!(rate, 1_100_000_000_000); // 1.1 * PRECISION
    }

    #[test]
    fn test_eurc_to_shares_at_1_to_1() {
        let shares = eurc_to_shares(100_000_000, PRECISION).unwrap();
        assert_eq!(shares, 100_000_000);
    }

    #[test]
    fn test_eurc_to_shares_at_higher_rate() {
        // Rate = 1.1, depositing 110 EURC → should get 100 shares
        let rate = 1_100_000_000_000u128;
        let shares = eurc_to_shares(110_000_000, rate).unwrap();
        assert_eq!(shares, 100_000_000);
    }

    #[test]
    fn test_shares_to_eurc_at_1_to_1() {
        let eurc = shares_to_eurc(100_000_000, PRECISION).unwrap();
        assert_eq!(eurc, 100_000_000);
    }

    #[test]
    fn test_shares_to_eurc_at_higher_rate() {
        // Rate = 1.1, 100 shares → should get 110 EURC
        let rate = 1_100_000_000_000u128;
        let eurc = shares_to_eurc(100_000_000, rate).unwrap();
        assert_eq!(eurc, 110_000_000);
    }

    #[test]
    fn test_round_down_protects_vault() {
        // Rate = 1.1, depositing 100 EURC → 90.909... shares → rounds to 90_909_090
        let rate = 1_100_000_000_000u128;
        let shares = eurc_to_shares(100_000_000, rate).unwrap();
        assert_eq!(shares, 90_909_090); // floor, not 90_909_091

        // Converting back: 90_909_090 shares at 1.1 rate = 99_999_999 EURC (not 100M)
        let back = shares_to_eurc(shares, rate).unwrap();
        assert!(back <= 100_000_000); // vault never loses
    }
}

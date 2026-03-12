use crate::errors::VaultError;
use crate::constants::PRECISION;

/// Calculate pending rewards for a user using MasterChef formula:
/// pending = (deposited_amount * acc_reward_per_share / PRECISION) - reward_debt
pub fn calculate_pending_rewards(
    deposited_amount: u64,
    accumulated_reward_per_share: u128,
    reward_debt: u128,
) -> Result<u64, anchor_lang::error::Error> {
    if deposited_amount == 0 {
        return Ok(0);
    }

    let accumulated = (deposited_amount as u128)
        .checked_mul(accumulated_reward_per_share)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(PRECISION)
        .ok_or(VaultError::MathOverflow)?;

    let pending = accumulated
        .checked_sub(reward_debt)
        .ok_or(VaultError::MathOverflow)?;

    // Safe: pending rewards in EURC base units will always fit in u64
    // (max ~18.4 * 10^18 base units = 18.4 trillion EURC)
    Ok(pending as u64)
}

/// Calculate new accumulated_reward_per_share after funding rewards:
/// new_acc = old_acc + (reward_amount * PRECISION / total_deposits)
pub fn calculate_new_acc_reward_per_share(
    current_acc: u128,
    reward_amount: u64,
    total_deposits: u64,
) -> Result<u128, anchor_lang::error::Error> {
    if total_deposits == 0 {
        // No stakers — rewards can't be distributed
        return Ok(current_acc);
    }

    let reward_per_share = (reward_amount as u128)
        .checked_mul(PRECISION)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(total_deposits as u128)
        .ok_or(VaultError::MathOverflow)?;

    current_acc
        .checked_add(reward_per_share)
        .ok_or_else(|| VaultError::MathOverflow.into())
}

/// Calculate reward_debt for a given deposit amount at current acc_reward_per_share:
/// reward_debt = deposited_amount * acc_reward_per_share / PRECISION
pub fn calculate_reward_debt(
    deposited_amount: u64,
    accumulated_reward_per_share: u128,
) -> Result<u128, anchor_lang::error::Error> {
    (deposited_amount as u128)
        .checked_mul(accumulated_reward_per_share)
        .ok_or(VaultError::MathOverflow)?
        .checked_div(PRECISION)
        .ok_or_else(|| VaultError::MathOverflow.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_rewards_with_zero_deposit() {
        let result = calculate_pending_rewards(0, 1_000_000, 0).unwrap();
        assert_eq!(result, 0);
    }

    #[test]
    fn test_basic_reward_calculation() {
        // User deposited 100 EURC (100_000_000 base units)
        // acc_reward_per_share = 10_000_000_000 (0.01 EURC per 1 EURC deposited)
        // reward_debt = 0 (first deposit at acc=0)
        let pending = calculate_pending_rewards(
            100_000_000, // 100 EURC
            10_000_000_000, // 0.01 per unit (scaled)
            0,
        ).unwrap();
        // 100_000_000 * 10_000_000_000 / 10^12 = 1_000_000 (1 EURC)
        assert_eq!(pending, 1_000_000);
    }

    #[test]
    fn test_acc_reward_per_share_update() {
        let new_acc = calculate_new_acc_reward_per_share(
            0,
            10_000_000, // 10 EURC reward
            100_000_000, // 100 EURC total deposits
        ).unwrap();
        // 10_000_000 * 10^12 / 100_000_000 = 100_000_000_000
        assert_eq!(new_acc, 100_000_000_000);
    }

    #[test]
    fn test_reward_debt_calculation() {
        let debt = calculate_reward_debt(
            100_000_000, // 100 EURC
            100_000_000_000, // acc reward
        ).unwrap();
        // 100_000_000 * 100_000_000_000 / 10^12 = 10_000_000
        assert_eq!(debt, 10_000_000);
    }

    #[test]
    fn test_no_rewards_distributed_to_empty_vault() {
        let acc = calculate_new_acc_reward_per_share(500, 1_000_000, 0).unwrap();
        assert_eq!(acc, 500); // unchanged
    }
}

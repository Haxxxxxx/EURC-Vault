# Risk Management Framework

## Overview

The EURC Cross-Protocol Yield Optimizer employs a multi-layered risk framework designed to protect depositor capital while maximizing yield. Risk management is not an afterthought — it is baked into every layer of the system: capital allocation rules, real-time monitoring, automated circuit breakers, and protocol selection criteria.

---

## Risk Categories

### 1. Protocol / Smart Contract Risk

**Threat:** A Drift, Kamino, or Save lending pool is exploited, causing loss of deposited EURC.

**Mitigations:**

- **Diversification mandate:** Minimum 10% allocation per active protocol. Maximum 70% in any single protocol. This ensures that even a total loss on one protocol results in a maximum 70% drawdown, not 100%.
- **Protocol selection criteria:** Only protocols with audited code, significant TVL (>$50M), and established track records are eligible. Drift, Kamino, and Save collectively represent the most battle-tested Solana lending venues.
- **Utilization cap:** When any protocol's utilization exceeds 85%, the optimizer stops directing new capital there. High utilization is a leading indicator of liquidity squeeze risk.
- **Circuit breaker:** Automatic vault-wide halt if TVL drops >2% from peak. All funds withdraw to idle pending manual review.

**Residual risk:** Smart contract risk cannot be fully eliminated. Users should understand that DeFi protocols carry inherent exploit risk.

### 2. Liquidity Risk

**Threat:** Depositors want to withdraw, but capital is locked in lending protocols with insufficient liquidity.

**Mitigations:**

- **5% idle reserve:** At all times, 5% of TVL sits undeployed in the vault's EURC account. Small withdrawals (under the idle buffer) are serviced instantly without any protocol interaction.
- **Withdrawal waiting period:** 24-hour withdrawal queue (standard Ranger Earn vault behavior). This gives the bot time to unwind positions orderly if needed.
- **Utilization monitoring:** The health check runs every 5 minutes. If protocol utilization approaches 90%+, the bot flags it and avoids adding to that position. High utilization means withdrawal of principal may take longer on that protocol.
- **Diversification:** Capital across three protocols means a liquidity crunch on one doesn't block full withdrawal. The bot can route withdrawal requests through less-utilized venues.

### 3. Market / Rate Risk

**Threat:** All three protocols' rates simultaneously drop, eliminating yield.

**Mitigations:**

- **Base rate exposure:** Even without spread arbitrage, depositors earn the baseline lending rate. In a low-rate environment (e.g., 3% base), returns are lower but capital is preserved.
- **Rate staleness detection:** Rates older than 10 minutes are treated as stale. The bot skips rebalancing decisions based on stale data rather than acting on potentially incorrect rates.
- **Oracle sanity check:** Rate deviations >50% from the 7-day moving average are flagged as suspicious (potential oracle manipulation or API error) and trigger fallback values.

### 4. Concentration Risk

**Threat:** Over time, drift in protocol rates causes the optimizer to pile too much into one venue.

**Mitigations:**

- **Hard cap: 70% max allocation per protocol.** This is enforced at the allocation computation layer. No single rebalance decision can direct more than 70% of TVL to one protocol.
- **Minimum floors: 10% per active protocol.** Active protocols always retain a minimum position, preventing total deallocation to a single venue.
- **Per-cycle move cap: 30% of TVL.** Even if the algorithm wants to move 50% of capital in one step, it's capped at 30% per cycle. This prevents large market-moving transactions and reduces slippage.
- **Rebalance cooldown: 30 minutes.** Prevents rapid oscillation between protocols that could amplify slippage and increase gas costs.

### 5. Operational Risk

**Threat:** Bot downtime, Firebase outage, or manager keypair compromise causes unauthorized transactions or missed rebalancing.

**Mitigations:**

- **Manager keypair in Firebase Secret Manager:** Never hardcoded, never in environment variables on disk. Accessed only within Cloud Function execution context.
- **Vault authority separation:** Admin keypair (vault creation, parameter changes) is separate from manager keypair (rebalancing only). A compromised manager key cannot drain the vault — it can only move funds between approved Ranger Earn adaptors.
- **Read-only rate fetching:** Rate monitoring functions have no signing authority. Even if a rate-fetching function is compromised, it cannot execute transactions.
- **Audit trail:** Every rebalance decision (including SKIP decisions) is logged to Firestore with timestamps, rates, and reasoning. Full auditability for post-incident review.
- **Firebase scheduled functions:** Functions are idempotent and stateless. A missed execution simply means one rebalance cycle is skipped — not a cascading failure.

### 6. Oracle / Rate Manipulation Risk

**Threat:** An attacker manipulates a protocol's reported APY to trick the optimizer into making suboptimal allocations.

**Mitigations:**

- **Multiple independent sources:** Rates are fetched independently from Drift, Kamino, and Save. Manipulating all three simultaneously would require coordinated attacks across independent protocols.
- **Spread threshold filter:** 50 bps minimum spread required to trigger rebalancing. Small manipulations below 50 bps are ignored.
- **Staleness checks:** Rates older than 10 minutes are disregarded. Flash-loan manipulation attacks that only temporarily distort rates are filtered out.
- **30-minute cooldown:** Even if a manipulation passes the spread filter, the cooldown prevents repeated exploit cycles. After one triggered rebalance, the bot won't rebalance again for 30 minutes.

---

## Circuit Breaker System

### Trigger Conditions

The circuit breaker trips automatically when **any** of the following occur:

1. **TVL drawdown > 2% from peak** — Suggests a protocol exploit, unexpected liquidation, or severe market event.
2. **Health score drops to EMERGENCY level** — Composite score incorporating drawdown, concentration, and utilization.
3. **Manual trip** — Admin can trip the circuit breaker via Firestore update for any operational concern.

### What Happens When Tripped

1. All scheduled rebalancing and compounding functions detect `circuitBreakerTripped: true` in Firestore and exit immediately without executing transactions.
2. A Discord/Telegram alert fires with severity level EMERGENCY.
3. Existing capital remains in protocols (it is NOT automatically withdrawn — forced withdrawals could incur unnecessary fees or slippage).
4. The vault enters a monitoring-only mode.

### Recovery

Circuit breaker reset requires manual intervention:

```
Set ranger_state/rebalancer.circuitBreakerTripped = false in Firestore
```

Before resetting, the admin should:
1. Identify the cause of the drawdown
2. Verify protocol solvency
3. Review recent transaction history
4. Confirm vault TVL is at expected levels

---

## Position Sizing Rules

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Max allocation per protocol | 70% | Limits single-protocol exposure |
| Min allocation per active protocol | 10% | Maintains diversification |
| Idle reserve | 5% | Withdrawal liquidity buffer |
| Max per-cycle rebalance | 30% of TVL | Prevents market impact, reduces slippage |
| Rebalance cooldown | 30 minutes | Prevents thrashing |
| Utilization cap | 85% | Liquidity risk buffer |
| Circuit breaker threshold | 2% drawdown | Early exit before significant losses |
| Compound threshold | 10 EURC | Avoids dust transactions |

---

## Drawdown Protection Waterfall

```
TVL drop 0–1%     → GREEN: Normal operation, monitor closely
TVL drop 1–1.5%   → YELLOW: Alert sent, reduce new rebalancing aggressiveness
TVL drop 1.5–2%   → RED: High-priority alert, prepare for CB trip
TVL drop > 2%     → EMERGENCY: Circuit breaker trips, all rebalancing halted
```

---

## Protocol-Specific Risk Notes

### Drift

- **Risk profile:** Medium. Drift is a perpetuals exchange using a cross-margin model. EURC lending is a spot market operation, separate from perp positions.
- **Key risk:** Drift's complex cross-margin system means a cascading liquidation event in perps could theoretically affect spot market liquidity. Monitored via utilization rate.
- **Mitigation:** Hard utilization cap at 85% prevents lending into a liquidity-stressed Drift pool.

### Kamino

- **Risk profile:** Medium-Low. Pure lending market with a simpler risk model than Drift.
- **Key risk:** Concentrated large depositors/borrowers in EURC can cause sudden rate swings. Kamino markets can be less liquid than USDC markets.
- **Mitigation:** Rate staleness and utilization monitoring catches Kamino-specific stress before it affects our position significantly.

### Save (formerly Solend)

- **Risk profile:** Medium. Save is the most established Solana lending protocol (launched 2021). Carries legacy code risk.
- **Key risk:** Save's governance has historically been slow to respond to market stress. The USDC/USDT depeg incidents of 2023 showed some response delay.
- **Mitigation:** Minimum floor allocation (10%) ensures Save is never a dominant position. If Save shows signs of stress, the optimizer naturally routes new capital to Drift and Kamino.

---

## Summary

Risk management is the optimizer's second core competency after rate arbitrage. The system is designed around the principle of **fail-safe defaults**: when uncertain, do nothing; when stressed, alert and halt; when emergency, freeze and wait for human review. Capital preservation trumps yield maximization in all edge cases.

# System Architecture

## Overview

The EURC Cross-Protocol Yield Optimizer is a distributed system with four major components: the **on-chain vault** (Ranger Earn infrastructure), the **automation bot** (Firebase Cloud Functions), the **frontend** (Next.js dashboard), and the **off-chain data layer** (Firestore). These components interact through a combination of on-chain instructions, REST API calls, and Firestore real-time subscriptions.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS                                    │
│          Deposit EURC / Withdraw EURC / Monitor Yield           │
└──────────────────────┬──────────────────────────────────────────┘
                       │  HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FRONTEND (Next.js 15)                          │
│  ranger/app/  — Deposit/Withdraw UI + Strategy Dashboard        │
│  ├── Wallet connect (Solana wallet-standard)                    │
│  ├── Vault SDK calls (@voltr/vault-sdk)                         │
│  ├── Real-time rate charts (Firestore subscription)             │
│  └── Rebalance history feed                                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │  Firestore SDK (real-time)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FIRESTORE (Data Layer)                         │
│  ranger_rates/latest        — Current protocol APYs             │
│  ranger_rates_history       — APY time series                   │
│  ranger_rebalances          — Rebalance event log               │
│  ranger_compounds           — Compound event log                │
│  ranger_health              — Health check history              │
│  ranger_metrics             — APY snapshots for charts          │
│  ranger_state/rebalancer    — Bot persistent state, circuit CB  │
└──────────────────────┬──────────────────────────────────────────┘
                       │  Firebase Admin SDK
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              FIREBASE CLOUD FUNCTIONS (Bot)                     │
│  functions/src/ranger/                                          │
│  ├── fetchRates       (every 5 min)  → read protocols, write FS │
│  ├── checkRebalance   (every 15 min) → read FS, execute Voltr tx │
│  ├── compound         (every 1 hour) → estimate yield, compound │
│  ├── healthCheck      (every 5 min)  → risk score, alerts       │
│  └── snapMetrics      (every 15 min) → APY snapshot to FS       │
└──────────────────────┬──────────────────────────────────────────┘
                       │  REST APIs + Solana RPC
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES                                  │
│  ├── Kamino API  (api.kamino.finance)  — EURC reserve rates     │
│  ├── Drift API   (data.api.drift.trade) — Spot market rates     │
│  ├── Save API    (api.save.finance)    — EURC reserve rates     │
│  └── Solana RPC  (Helius/QuickNode)   — On-chain tx submission  │
└──────────────────────┬──────────────────────────────────────────┘
                       │  Solana transactions (@voltr/vault-sdk)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              SOLANA ON-CHAIN                                    │
│  ├── Ranger Earn Vault Program (vVoLTR...)                      │
│  │   └── Our Vault PDA (created via create-vault.ts)           │
│  ├── Ranger Drift Adaptor    (EBN93e...)                        │
│  ├── Ranger Kamino Adaptor   (to6Eti...)                        │
│  └── Ranger Save/Lending Adaptor (aVoLTR...)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Deep Dives

### 1. On-Chain Vault (Ranger Earn)

The vault itself is built on the **Ranger Earn** infrastructure. We do not write any on-chain code — instead, we configure a vault using the `@voltr/vault-sdk` and register pre-deployed adaptors.

**Vault configuration:**
- Token: EURC (6 decimals)
- Management fee: 0.5% (50 bps annually)
- Performance fee: 10% (on profits)
- Max capacity: 1,000,000 EURC
- Withdrawal wait: 24 hours

**Adaptor registration:** Three adaptors are registered with the vault, each bridging to a different lending protocol:

| Adaptor | Protocol | On-Chain ID |
|---------|----------|-------------|
| Drift Adaptor | Drift spot lending | `EBN93eXs5fHGBABuajQqdsKRkCgaqtJa8vEFD6vKXiP` |
| Kamino Adaptor | Kamino lending | `to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR` |
| Save Adaptor | Save/Solend | `aVoLTRCRt3NnnchvLYH6rMYehJHwM5m45RmLBZq7PGz` |

**Key vault operations:**
- `depositToStrategy(adaptor, amount)` — Move EURC from vault to a lending protocol
- `withdrawFromStrategy(adaptor, amount)` — Pull EURC back from a lending protocol
- All operations are gated by the manager keypair

### 2. Automation Bot (Firebase Cloud Functions)

The bot lives in `functions/src/ranger/` and runs as Google Cloud scheduler-triggered functions. Each function is independent and stateless — state persists only in Firestore.

**Execution flow per cycle:**

```
fetchRates (t=0, t+5, t+10...)
    ↓ writes ranger_rates/latest
checkRebalance (t=0, t+15, t+30...)
    ↓ reads ranger_rates/latest
    ↓ reads ranger_state/rebalancer
    ↓ evaluates: spread? cooldown? circuit breaker?
    ↓ executes Voltr SDK tx if YES
    ↓ writes ranger_rebalances/{id}
    ↓ updates ranger_state/rebalancer
healthCheck (t=0, t+5, t+10...)
    ↓ reads ranger_rates/latest
    ↓ reads ranger_state/rebalancer
    ↓ computes risk score
    ↓ sends Discord alert if YELLOW/RED/EMERGENCY
    ↓ writes ranger_health/{id}
compound (t=0, t+60, t+120...)
    ↓ reads current vault state
    ↓ estimates accrued interest
    ↓ executes compound tx if > 10 EURC threshold
    ↓ writes ranger_compounds/{id}
snapMetrics (t=0, t+15, t+30...)
    ↓ reads ranger_rates/latest + event counts
    ↓ computes blended APY
    ↓ writes ranger_metrics/{id} + ranger_metrics/latest
```

**Security architecture:**
- Manager keypair stored in Firebase Secret Manager (`RANGER_MANAGER_KEYPAIR`)
- Only `checkRebalance` and `compound` functions access the keypair
- `fetchRates`, `healthCheck`, and `snapMetrics` are read-only — no signing authority
- Vault admin keypair is never in Firebase (only used for initial vault setup)

### 3. Off-Chain Data Layer (Firestore)

Firestore serves as the shared memory bus between bot functions and the frontend.

**Collection schema:**

```
ranger_rates/
  latest/              # Single document — current best rates
    drift: { apy, apyBps, utilization, isStale, fetchedAt }
    kamino: { ... }
    save: { ... }
    best: "drift"
    spreadBps: 120
    fetchedAt: 1712345678000

ranger_rates_history/
  {auto-id}/           # One doc per fetch cycle (every 5 min)
    [same fields as latest]

ranger_rebalances/
  {auto-id}/
    decision: "REBALANCE" | "SKIP"
    reason: "Spread 120 bps ≥ threshold"
    spreadBps: 120
    highestRateProtocol: "drift"
    currentBlendedApyPct: 7.2
    targetBlendedApyPct: 7.8
    estimatedGainBps: 60
    txSig: "5abc..."
    timestamp: 1712345678000

ranger_compounds/
  {auto-id}/
    harvestedEurc: 15.234
    redeployedToProtocol: "kamino"
    apyAtRedeployPct: 8.1
    txSig: "3def..."
    timestamp: 1712345678000

ranger_health/
  {auto-id}/
    level: "GREEN" | "YELLOW" | "RED" | "EMERGENCY"
    healthScore: 95
    drawdownPct: 0.1
    utilizationWarnings: []
    alertSent: false
    timestamp: 1712345678000

ranger_metrics/
  latest/              # Single document — latest metrics for quick dashboard load
    tvlEurc: 100000
    currentApyPct: 8.4
    spreadBps: 120
    rebalances24h: 3
    compounds24h: 24
    healthScore: 95
    timestamp: 1712345678000
  {auto-id}/           # Historical snapshots for charting

ranger_state/
  rebalancer/          # Persistent bot state
    lastRebalanceAt: 1712345678000
    totalRebalances: 47
    circuitBreakerTripped: false
    peakTvlEurc: 102000
    updatedAt: 1712345678000
  compound/
    lastCompoundAt: 1712345678000
    updatedAt: 1712345678000
```

### 4. Local Bot Runner (`ranger/bot/index.ts`)

For development and testing, the bot can run as a local Node.js process using `setInterval` loops. This mirrors the Firebase function schedules exactly.

```
npm run bot    # from ranger/
```

Local mode uses `.env` for configuration. When `VAULT_ADDRESS` is not set, it runs in simulation mode with mock vault state — useful for validating logic without a live vault.

---

## Data Flow: Rebalance Cycle

```
1. [fetchRates] Kamino REST API ──────────────────────┐
2. [fetchRates] Drift REST API  ─────────────────────→│ → ranger_rates/latest
3. [fetchRates] Save REST API   ──────────────────────┘

4. [checkRebalance] Read ranger_rates/latest
5. [checkRebalance] Read ranger_state/rebalancer (lastRebalanceAt)
6. [checkRebalance] Evaluate: spreadBps(120) >= 50? YES. cooldown elapsed? YES.
7. [checkRebalance] Compute: target allocation = {drift:65%, kamino:10%, save:10%, idle:5%}
8. [checkRebalance] Build Voltr SDK instructions:
   - withdrawFromStrategy(kamino_adaptor, 200_000_000)  # pull from underperformer
   - depositToStrategy(drift_adaptor,   200_000_000)    # deploy to best rate
9. [checkRebalance] Sign + send versioned transaction (manager keypair)
10.[checkRebalance] Write ranger_rebalances/{id} with txSig, rates, decision
11.[checkRebalance] Update ranger_state/rebalancer.lastRebalanceAt = now

12.[snapMetrics] Read rates + event counts
13.[snapMetrics] Write ranger_metrics/latest with new blended APY
14.[frontend] Firestore onSnapshot listener fires → dashboard updates in real-time
```

---

## Deployment Topology

```
Production:
  Firebase Project: eurc-vault (us-central1)
  Cloud Functions: 5 scheduled Ranger functions + existing EURC Vault functions
  Firestore: native mode, us-central1
  Secret Manager: RANGER_MANAGER_KEYPAIR (base58-encoded private key)

  Solana: mainnet-beta
  RPC: Helius (SOLANA_RPC_URL in Secret Manager)

Development:
  Firebase Emulator: functions + firestore
  Solana: devnet (with USDC proxy for EURC)
  Local bot: npm run bot (ranger/ directory)
```

---

## Setup Scripts (`ranger/scripts/`)

The `scripts/` directory contains one-time setup scripts that must be run before the bot operates:

| Script | Purpose | Run Once? |
|--------|---------|-----------|
| `create-vault.ts` | Initialize Ranger Earn vault on-chain | Yes (creates vault PDA) |
| `add-adaptors.ts` | Register Drift/Kamino/Save adaptors with vault | Yes |
| `init-strategies.ts` | Initialize EURC lending positions on each protocol | Yes |
| `seed-deposit.ts` | Deposit initial EURC for liquidity bootstrapping | Optional |

After running these scripts, the `VAULT_ADDRESS` env var is set and the bot can begin operating.

---

## Technology Choices

| Layer | Technology | Why |
|-------|-----------|-----|
| On-chain | Ranger Earn (`@voltr/vault-sdk`) | Purpose-built for yield vault strategies on Solana |
| Bot runtime | Firebase Cloud Functions (Node 20) | Managed scheduling, Secret Manager integration, zero infra maintenance |
| Database | Firestore | Real-time subscriptions enable live frontend updates |
| Frontend | Next.js 15 (Voltr basic-ui fork) | Fastest path to working deposit/withdraw UI |
| Language | TypeScript (strict mode) | Type safety across bot + frontend |
| Alerting | Discord webhooks | Simple, reliable, widely used in DeFi |

# EURC Cross-Protocol Yield Optimizer

> **Ranger Build-A-Bear Hackathon Submission** — April 2026

A Ranger Earn vault strategy that maximizes EURC yield by dynamically routing capital across Drift, Kamino, and Save lending protocols. Targets 12–15% APY through continuous rate arbitrage and auto-compounding.

## How It Works

1. **Rate monitoring** — Every 5 minutes, fetch EURC supply APYs from Drift, Kamino, and Save
2. **Rebalancing** — When the best and worst rates diverge by ≥50 bps, shift capital to the highest-yield protocol
3. **Compounding** — Every hour, harvest accrued interest and re-deposit into the top-rate protocol
4. **Risk protection** — Circuit breaker halts all activity if TVL drops >2% from peak

```
Drift  ─┐
Kamino ─┤ ← Ranger Earn Vault → Depositors earn optimized yield
Save   ─┘
```

## Repository Structure

```
ranger/
├── bot/                     # Automation bot (mirrors Firebase functions)
│   ├── config.ts            # All tunable parameters (program IDs, thresholds)
│   ├── types.ts             # Shared TypeScript types
│   ├── index.ts             # Local bot runner (npm run bot)
│   ├── rates/
│   │   ├── drift.ts         # Drift EURC rate fetcher
│   │   ├── kamino.ts        # Kamino EURC rate fetcher
│   │   ├── save.ts          # Save EURC rate fetcher
│   │   └── aggregator.ts    # Unified rate aggregation with fallbacks
│   ├── engine/
│   │   ├── rebalancer.ts    # Core allocation logic (spread check, target allocation)
│   │   ├── compounder.ts    # Interest harvesting and re-deposit
│   │   ├── executor.ts      # Voltr SDK tx builder + send with retry
│   │   ├── risk.ts          # Health score, drawdown tracking, concentration limits
│   │   └── circuit-breaker.ts # Emergency halt logic
│   └── monitoring/
│       ├── metrics.ts       # APY calculation (time-weighted return)
│       ├── alerts.ts        # Discord/Telegram webhook alerts
│       └── logger.ts        # Structured JSON logging
├── scripts/                 # One-time setup scripts
│   ├── create-vault.ts      # Initialize Ranger Earn vault on-chain
│   ├── add-adaptors.ts      # Register Drift/Kamino/Save adaptors
│   ├── init-strategies.ts   # Initialize lending positions
│   └── seed-deposit.ts      # Bootstrap vault with initial EURC
├── docs/                    # Architecture and strategy docs
│   ├── strategy.md          # Strategy thesis and return analysis
│   ├── risk-management.md   # Risk framework and circuit breaker docs
│   └── architecture.md      # System architecture and data flow
├── .env.example             # Required environment variables
├── package.json
└── tsconfig.json

functions/src/ranger/        # Firebase Cloud Functions (production bot)
├── types.ts                 # Self-contained Firestore types
├── fetchRates.ts            # Scheduled every 5 min
├── checkRebalance.ts        # Scheduled every 15 min
├── compound.ts              # Scheduled every 1 hour
├── healthCheck.ts           # Scheduled every 5 min (with Discord alerts)
└── snapMetrics.ts           # Scheduled every 15 min (APY snapshots)
```

## Quick Start

### Prerequisites

- Node.js 20+
- Solana CLI (`solana --version`)
- Two keypairs: `vault-admin.json` and `vault-manager.json`
- EURC tokens (or USDC on devnet)

### 1. Install Dependencies

```bash
cd ranger
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `SOLANA_RPC_URL` — Helius or QuickNode RPC endpoint
- `VAULT_ADMIN_KEYPAIR_PATH` — path to admin keypair JSON
- `VAULT_MANAGER_KEYPAIR_PATH` — path to manager keypair JSON
- `DISCORD_WEBHOOK_URL` — Discord webhook for alerts (optional)

### 3. Create the Vault (one-time)

```bash
# Create Ranger Earn vault
npx tsx scripts/create-vault.ts

# Register the three protocol adaptors
npx tsx scripts/add-adaptors.ts

# Initialize lending positions on each protocol
npx tsx scripts/init-strategies.ts

# Optional: seed initial deposit
npx tsx scripts/seed-deposit.ts
```

After running `create-vault.ts`, copy the printed `VAULT_ADDRESS` into your `.env`.

> **Devnet note:** EURC may not have active markets on devnet. Set `EURC_MINT` to the USDC devnet mint as a proxy: `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr`

### 4. Run the Bot Locally

```bash
npm run bot
```

The bot runs all monitoring loops locally using `setInterval`. Output is structured JSON logs. When `VAULT_ADDRESS` is not set, runs in **simulation mode** with mock vault state.

### 5. Deploy Firebase Functions (Production)

```bash
# From project root
cd functions
npm run build

# Configure Secret Manager
gcloud secrets create RANGER_MANAGER_KEYPAIR --data-file=vault-manager.json

# Deploy
firebase deploy --only functions
```

The 5 Ranger functions will appear in your Firebase console as scheduled Cloud Functions.

## Key Parameters

All tunable parameters live in `bot/config.ts`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `REBALANCE_MIN_SPREAD_BPS` | 50 | Min rate spread to trigger rebalance |
| `MAX_ALLOCATION_PCT` | 70% | Max capital in any single protocol |
| `MIN_ALLOCATION_PCT` | 10% | Min capital in any active protocol |
| `IDLE_RESERVE_PCT` | 5% | Liquidity buffer, never deployed |
| `REBALANCE_COOLDOWN_MS` | 30 min | Minimum time between rebalances |
| `COMPOUND_MIN_AMOUNT` | 10 EURC | Minimum accrued interest before compounding |
| `CIRCUIT_BREAKER_DRAWDOWN_PCT` | 2% | Drawdown from peak before emergency halt |
| `MAX_UTILIZATION` | 85% | Protocol utilization cap for deposits |
| `DRIFT_SPOT_MARKET_INDEX` | 15 | Drift spot market index for EURC |

## On-Chain Addresses

| Contract | Address |
|----------|---------|
| Ranger Vault Program | `vVoLTRjQmtFpiYoegx285Ze4gsLJ8ZxgFKVcuvmG1a8` |
| Drift Adaptor | `EBN93eXs5fHGBABuajQqdsKRkCgaqtJa8vEFD6vKXiP` |
| Kamino Adaptor | `to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR` |
| Save/Lending Adaptor | `aVoLTRCRt3NnnchvLYH6rMYehJHwM5m45RmLBZq7PGz` |
| EURC Mint (mainnet) | `HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr` |
| USDC Devnet (proxy) | `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr` |

## Firestore Collections

The bot writes to these Firestore collections (readable by the frontend):

| Collection | Purpose | Update Frequency |
|------------|---------|-----------------|
| `ranger_rates/latest` | Current protocol APYs | Every 5 min |
| `ranger_rates_history` | APY time series | Every 5 min |
| `ranger_rebalances` | Rebalance event log | On rebalance |
| `ranger_compounds` | Compound event log | Hourly |
| `ranger_health` | Health check history | Every 5 min |
| `ranger_metrics/latest` | Current APY snapshot | Every 15 min |
| `ranger_metrics` | Historical APY snapshots | Every 15 min |
| `ranger_state/rebalancer` | Bot state, circuit breaker | On state change |

## Type-Check

```bash
# Ranger bot
cd ranger && npx tsc --noEmit

# Firebase functions
cd functions && npm run typecheck
```

Both should exit clean.

## Documentation

- [Strategy Thesis](docs/strategy.md) — Why this works, return analysis, market conditions
- [Risk Management](docs/risk-management.md) — Risk framework, circuit breaker, protocol-specific risks
- [Architecture](docs/architecture.md) — System design, data flow, component interactions

## Development Status

| Phase | Status |
|-------|--------|
| 1. Foundation (scaffold, scripts, rate fetching) | ✅ Complete |
| 2. Bot engine (rebalancer, compounder, risk, circuit breaker) | ✅ Complete |
| 3. Firebase Cloud Functions | ✅ Complete |
| 4. Frontend dashboard (5 routes, static build) | ✅ Complete |
| 5. Documentation | ✅ Complete |
| 6. Real SDK wiring (VoltrClient calls) | ✅ Complete |
| 7. Unit tests (82 tests, 5 suites) | ✅ Complete |
| Devnet testing | ⚠️ Blocked — Voltr program is mainnet-only |

## License

MIT — built for the Ranger Build-A-Bear Hackathon, April 2026.

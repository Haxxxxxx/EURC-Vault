# Production Deployment Runbook

**EURC Cross-Protocol Yield Optimizer — Ranger Earn Vault**

This document covers the full end-to-end deployment of the EURC yield optimizer: on-chain vault creation, protocol strategy initialization, bot deployment, Cloud Functions, and frontend hosting.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Create Vault](#step-1-create-vault)
3. [Step 2: Register Adaptors](#step-2-register-adaptors)
4. [Step 3: Initialize Strategies](#step-3-initialize-strategies)
5. [Step 4: Seed Deposit](#step-4-seed-deposit)
6. [Step 5: Deploy Cloud Functions](#step-5-deploy-cloud-functions)
7. [Step 6: Start Bot](#step-6-start-bot)
8. [Step 7: Deploy Frontend](#step-7-deploy-frontend)
9. [Monitoring and Alerts](#monitoring-and-alerts)
10. [Emergency Procedures](#emergency-procedures)
11. [Environment Variable Reference](#environment-variable-reference)

---

## Prerequisites

### Software

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20.x LTS | `nvm install 20` |
| npm | 10+ | Bundled with Node.js 20 |
| Solana CLI | 1.18+ | [solana.com/docs/intro/installation](https://docs.solanalabs.com/cli/install) |
| Firebase CLI | 13+ | `npm install -g firebase-tools` |
| TypeScript (tsx) | 4+ | Included in `ranger/` devDependencies |

### Wallets

You need **two funded Solana keypairs** stored as JSON files:

| Wallet | Purpose | Minimum Balance |
|--------|---------|-----------------|
| **Admin** | Creates vault, registers adaptors, seed deposit | 0.5 SOL + EURC for seed deposit |
| **Manager** | Initializes strategies, executes rebalances | 0.5 SOL |

Generate keypairs (if you don't have them):

```bash
solana-keygen new -o ./keys/admin.json --no-bip39-passphrase
solana-keygen new -o ./keys/manager.json --no-bip39-passphrase
```

Fund on devnet for testing:

```bash
solana airdrop 2 $(solana-keygen pubkey ./keys/admin.json) --url devnet
solana airdrop 2 $(solana-keygen pubkey ./keys/manager.json) --url devnet
```

For **mainnet**, transfer SOL and EURC to both wallets from an existing funded wallet.

### Firebase Project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore Database** (production mode)
3. Create a **Web app** (for frontend config)
4. Generate a **Service Account key** (Project Settings > Service accounts > Generate new private key)
5. Save the service account JSON file securely (e.g., `./keys/firebase-sa.json`)

### Install Dependencies

```bash
# From the repository root
cd ranger && npm install
cd ../ranger/app && npm install
cd ../functions && npm install
```

---

## Step 1: Create Vault

Creates the Ranger Earn vault on-chain. This generates a new vault keypair and registers it with the Voltr vault program.

### Configure Environment

```bash
cd ranger
cp .env.example .env
```

Edit `.env` with your deployment values:

```bash
# ─── Cluster (use devnet for testing, mainnet-beta for production) ────
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_CLUSTER=mainnet-beta

# ─── Wallets ──────────────────────────────────────────────────────────
VAULT_ADMIN_KEYPAIR_PATH=./keys/admin.json
VAULT_MANAGER_KEYPAIR_PATH=./keys/manager.json

# ─── EURC Mint (mainnet) ─────────────────────────────────────────────
EURC_MINT=HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr
```

> **Note**: For devnet testing, omit `EURC_MINT` to use the USDC devnet proxy (`Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr`).

### Run

```bash
npm run create-vault
```

### Expected Output

```
═══════════════════════════════════════════════
  EURC Yield Optimizer — Create Vault
  Cluster: mainnet-beta
  RPC: https://api.mainnet-beta.solana.com
═══════════════════════════════════════════════

Admin:   <admin-pubkey>
Manager: <manager-pubkey>
EURC Mint: HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr

Admin balance:   0.5000 SOL
Manager balance: 0.5000 SOL

Vault Keypair: <vault-pubkey>

Creating vault with config:
  Max Cap: 1,000,000 EURC
  Mgmt Fee: 50 bps (0.5%)
  Perf Fee: 1000 bps (10%)
  Locked Profit Duration: 24h

  Vault created!
   Vault address: <vault-pubkey>
   TX signature:  <tx-sig>

Next step — add to .env:
  VAULT_ADDRESS=<vault-pubkey>

Then run: npm run add-adaptors
```

### Post-Step

Add the vault address to `.env`:

```bash
VAULT_ADDRESS=<vault-pubkey-from-output>
```

Vault parameters (hardcoded in `bot/config.ts`):
- Max capacity: 1,000,000 EURC
- Management fee: 50 bps (0.5% annual)
- Performance fee: 1000 bps (10%, high-water mark)
- Locked profit degradation: 86,400 seconds (24 hours)

---

## Step 2: Register Adaptors

Registers the three protocol adaptors (Drift, Kamino, Save) on the vault. These are pre-deployed Ranger Earn programs that handle protocol-specific deposit/withdraw/harvest logic.

### Adaptor Program IDs

| Protocol | Adaptor Program ID |
|----------|-------------------|
| Save/Lending | `aVoLTRCRt3NnnchvLYH6rMYehJHwM5m45RmLBZq7PGz` |
| Drift | `EBN93eXs5fHGBABuajQqdsKRkCgaqtJa8vEFD6vKXiP` |
| Kamino | `to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR` |

### Prerequisites

- `VAULT_ADDRESS` set in `.env` (from Step 1)
- `VAULT_ADMIN_KEYPAIR_PATH` set in `.env`

### Run

```bash
npm run add-adaptors
```

### Expected Output

```
═══════════════════════════════════════════════
  EURC Yield Optimizer — Add Adaptors
  Cluster: mainnet-beta
═══════════════════════════════════════════════

Vault:  <vault-address>
Admin:  <admin-pubkey>

Registering adaptor: Save/Lending
  Program ID: aVoLTRCRt3NnnchvLYH6rMYehJHwM5m45RmLBZq7PGz
  Save (Solend) EURC lending reserve — 5–7% APY
  Registered — TX: <tx-sig>

Registering adaptor: Drift
  Program ID: EBN93eXs5fHGBABuajQqdsKRkCgaqtJa8vEFD6vKXiP
  Drift Protocol EURC spot market lending — 8–12% APY
  Registered — TX: <tx-sig>

Registering adaptor: Kamino
  Program ID: to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR
  Kamino Finance kLend EURC reserve — 6–8% APY
  Registered — TX: <tx-sig>

Verifying adaptor registrations...
  Registered adaptors: 3

All adaptors registered. Run init-strategies.ts next.
  npm run init-strategies
```

---

## Step 3: Initialize Strategies

Creates protocol-specific strategy accounts on-chain. Each strategy is a PDA that the bot uses to deposit/withdraw from that protocol.

### Prerequisites

Add protocol-specific addresses to `.env` before running:

```bash
# ─── Drift ────────────────────────────────────────────────────────────
DRIFT_SPOT_MARKET_INDEX=54
DRIFT_ORACLE_ADDRESS=<drift-eurc-oracle-pubkey>

# ─── Kamino ───────────────────────────────────────────────────────────
KAMINO_RESERVE_ADDRESS=EGPE45iPkme8G8C1xFDNZoZeHdP3aRYtaAfAQuuwrcGZ

# ─── Save (Solend) ───────────────────────────────────────────────────
SAVE_RESERVE_ADDRESS=ECNduHkbaQL5mgNenGCwYhXtdv4tqVjeRcCYwUeQQHc1
SAVE_LENDING_MARKET=4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY
SAVE_COUNTERPARTY_TA=<save-eurc-supply-token-account>
SAVE_COLLATERAL_MINT=<save-eurc-collateral-mint>
SAVE_PYTH_ORACLE=<save-eurc-pyth-oracle>
SAVE_SWITCHBOARD_ORACLE=<save-eurc-switchboard-oracle>
```

> **Finding these addresses**: Query each protocol's on-chain state or use their respective explorer UIs. Kamino and Save defaults are provided in `bot/config.ts` where available.

### Run

```bash
npm run init-strategies
```

### Expected Output

```
═══════════════════════════════════════════════
  EURC Yield Optimizer — Initialize Strategies
  Cluster: mainnet-beta
═══════════════════════════════════════════════

Vault:   <vault-address>
Manager: <manager-pubkey>

1. Initializing Drift Strategy
   Strategy PDA: <drift-strategy-pda>
   Drift strategy initialized: <drift-strategy-pda>
   TX: <tx-sig>
   Add to .env: DRIFT_STRATEGY_ADDRESS=<drift-strategy-pda>

2. Initializing Kamino Strategy
   Reserve / Strategy: <kamino-strategy-pda>
   Kamino strategy initialized: <kamino-strategy-pda>
   TX: <tx-sig>
   Add to .env: KAMINO_STRATEGY_ADDRESS=<kamino-strategy-pda>

3. Initializing Save/Lending Strategy
   Strategy PDA: <save-strategy-pda>
   Save strategy initialized: <save-strategy-pda>
   TX: <tx-sig>
   Add to .env: SAVE_STRATEGY_ADDRESS=<save-strategy-pda>
```

### Post-Step

Add strategy addresses to `.env`:

```bash
DRIFT_STRATEGY_ADDRESS=<drift-strategy-pda>
KAMINO_STRATEGY_ADDRESS=<kamino-strategy-pda>
SAVE_STRATEGY_ADDRESS=<save-strategy-pda>
```

---

## Step 4: Seed Deposit

Deposits initial EURC into the vault to bootstrap it. The admin wallet must hold EURC tokens.

### Prerequisites

- All previous steps completed
- Admin wallet holds EURC (or USDC on devnet)
- Admin wallet holds >= 0.01 SOL for tx fees

### Run

```bash
# Default: 10 EURC
npm run seed-deposit

# Custom amount:
SEED_AMOUNT_EURC=100 npm run seed-deposit
```

### Expected Output

```
═══════════════════════════════════════════════
  EURC Yield Optimizer — Seed Deposit
  Cluster: mainnet-beta
  Amount: 100 EURC
═══════════════════════════════════════════════

Depositor: <admin-pubkey>
Vault:     <vault-address>
Mint:      HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr
Amount:    100 EURC (100000000 atoms)

SOL balance: 0.4500 SOL
EURC balance: 500.000000 EURC

Expected LP tokens: 100000000

Depositing 100 EURC...
  Deposited 100 EURC
   TX: <tx-sig>

Vault state after deposit:
  Total value: 100000000 atoms
```

### Verification

Confirm the vault state on Solana Explorer:

```bash
# View vault account
solana account <VAULT_ADDRESS> --url mainnet-beta

# View on Solscan
open "https://solscan.io/account/<VAULT_ADDRESS>"
```

---

## Step 5: Deploy Cloud Functions

The Firebase Cloud Functions run the same bot logic on a schedule (rate fetching, rebalance checks, compounding, health checks, metrics snapshots).

### Configure Firebase

```bash
# Login to Firebase CLI
firebase login

# Set the active project
firebase use <your-firebase-project-id>
```

### Set Function Environment Variables

Firebase Functions need access to Solana RPC and vault configuration. Set them using the Firebase CLI:

```bash
firebase functions:config:set \
  solana.rpc_url="https://api.mainnet-beta.solana.com" \
  solana.cluster="mainnet-beta" \
  vault.address="<VAULT_ADDRESS>" \
  vault.admin_keypair="<base58-encoded-admin-keypair>" \
  vault.manager_keypair="<base58-encoded-manager-keypair>"
```

> **Security**: For production, use [Google Cloud Secret Manager](https://cloud.google.com/secret-manager) instead of `functions:config:set` for keypair storage.

### Deploy

```bash
# From the repository root
firebase deploy --only functions
```

This runs the predeploy steps automatically (defined in `firebase.json`):
1. Builds the SDK: `npm run build -w packages/sdk`
2. Builds the functions: `npm --prefix functions run build`

### Cloud Function Schedule

| Function | Schedule | Description |
|----------|----------|-------------|
| `fetchRates` | Every 5 minutes | Fetches EURC supply APYs from Drift, Kamino, Save |
| `checkRebalance` | Every 15 minutes | Evaluates and executes rebalance if spread > 50 bps |
| `compound` | Every 1 hour | Harvests accrued interest and re-deploys to top protocol |
| `healthCheck` | Every 5 minutes | Assesses risk level, triggers circuit breaker if needed |
| `snapMetrics` | Every 15 minutes | Generates and persists metrics snapshot to Firestore |

### Verify Deployment

```bash
firebase functions:list
```

Check function logs:

```bash
firebase functions:log --only fetchRates
```

---

## Step 6: Start Bot

The bot can run locally as a long-lived process or alongside the Cloud Functions. Local mode is useful for development, monitoring, and as a backup to Cloud Functions.

### Environment

Ensure `ranger/.env` has all required variables set from Steps 1-4, plus:

```bash
# ─── Firebase (for metrics persistence) ──────────────────────────────
FIREBASE_PROJECT_ID=<your-firebase-project-id>
FIREBASE_SERVICE_ACCOUNT_PATH=./keys/firebase-sa.json

# ─── Alerts (optional but recommended for production) ────────────────
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/<id>/<token>
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_CHAT_ID=<chat-id>

# ─── Strategy tuning (defaults shown — override as needed) ───────────
REBALANCE_MIN_SPREAD_BPS=50
MAX_ALLOCATION_PCT=70
MIN_ALLOCATION_PCT=10
IDLE_RESERVE_PCT=5
REBALANCE_COOLDOWN_MS=1800000
COMPOUND_MIN_AMOUNT=10000000
CIRCUIT_BREAKER_DRAWDOWN_PCT=2

# ─── Transaction tuning ─────────────────────────────────────────────
COMPUTE_UNIT_LIMIT=400000
PRIORITY_FEE_MICRO_LAMPORTS=5000
```

### Run Locally

```bash
cd ranger
npm run bot
```

### Expected Startup Output

```
EURC Cross-Protocol Yield Optimizer starting up
  cluster: mainnet-beta
  vaultAddr: <vault-address>

Bot running
  rateFetchEvery: 5 min
  rebalanceEvery: 15 min
  compoundEvery: 60 min
  healthEvery: 5 min
```

### Run as a System Service (Linux/macOS)

For production, run the bot as a systemd service or use a process manager:

**Using pm2:**

```bash
npm install -g pm2

cd ranger
pm2 start "npm run bot" --name eurc-optimizer
pm2 save
pm2 startup  # Follow instructions to enable auto-start on reboot
```

**Using systemd (Linux):**

```ini
# /etc/systemd/system/eurc-optimizer.service
[Unit]
Description=EURC Cross-Protocol Yield Optimizer Bot
After=network.target

[Service]
Type=simple
User=deployer
WorkingDirectory=/opt/eurc-vault/ranger
ExecStart=/usr/bin/npm run bot
Restart=always
RestartSec=10
EnvironmentFile=/opt/eurc-vault/ranger/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable eurc-optimizer
sudo systemctl start eurc-optimizer
sudo journalctl -u eurc-optimizer -f  # Follow logs
```

### Graceful Shutdown

The bot handles `SIGINT` and `SIGTERM` — all interval timers are cleared before exit.

---

## Step 7: Deploy Frontend

The frontend is a Next.js 15 static export hosted on Firebase Hosting (free Spark plan).

### Configure Frontend Environment

```bash
cd ranger/app
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# ─── Solana ──────────────────────────────────────────────────────────
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta

# ─── Vault (set after Step 1) ───────────────────────────────────────
NEXT_PUBLIC_VAULT_ADDRESS=<vault-address>

# ─── Firebase (optional — enables real-time Firestore data) ─────────
NEXT_PUBLIC_FIREBASE_API_KEY=<api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<project>.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
NEXT_PUBLIC_FIREBASE_APP_ID=<app-id>
```

> **Without Firebase config**: The app works fully using live API routes (`/api/rates`, `/api/metrics`) that fetch directly from Drift, Kamino, and Save REST APIs with 60-second caching.

> **With Firebase config**: The app adds real-time Firestore listeners for instant updates and historical data from the scheduled Cloud Functions.

### Build and Deploy

```bash
# Build the static export
cd ranger/app
npm run build
# Output directory: ranger/app/out/

# Deploy to Firebase Hosting (from repo root)
cd ../..
firebase deploy --only hosting
```

The `firebase.json` hosting config:
- Serves from `ranger/app/out/`
- SPA rewrite: all routes fallback to `/index.html`
- Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- Static assets (JS/CSS): `Cache-Control: public, max-age=31536000, immutable`

### Verify

```bash
# Open the deployed site
firebase hosting:channel:list
open https://<project-id>.web.app
```

### Custom Domain (Optional)

```bash
firebase hosting:sites:list
# Add custom domain via Firebase Console > Hosting > Add custom domain
```

---

## Monitoring and Alerts

### Alert Channels

Configure in `ranger/.env`:

| Channel | Env Vars | Setup |
|---------|----------|-------|
| Discord | `DISCORD_WEBHOOK_URL` | Server Settings > Integrations > Webhooks > New Webhook |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Create bot via @BotFather, get chat ID via getUpdates API |

### Alert Types

| Event | Level | Trigger |
|-------|-------|---------|
| Rebalance executed | INFO | Spread > 50 bps, capital moved between protocols |
| Auto-compound | INFO | Interest harvested and re-deployed |
| Risk warning | WARN | High utilization (>85%) detected on a protocol |
| Health RED | ERROR | Health score critically low |
| Circuit breaker trip | EMERGENCY | TVL drawdown >= 2% from peak |

### Metrics (Firestore)

When `FIREBASE_PROJECT_ID` is configured, the bot writes to these Firestore collections:

| Collection | Document | Contents |
|------------|----------|----------|
| `ranger_metrics` | `latest` | Current blended APY, health score, allocation breakdown |
| `ranger_metrics` | Auto-generated docs | Historical snapshots (every 15 min) |

### Bot Task Schedule

| Task | Interval | What It Does |
|------|----------|--------------|
| Rate fetch | 5 min | Polls Drift, Kamino, Save REST APIs for current EURC supply APY |
| Rebalance check | 15 min | Evaluates spread, executes withdraw/deposit if threshold met |
| Compound | 1 hour | Harvests accrued interest, re-deploys to highest-rate protocol |
| Health check | 5 min | Assesses risk (drawdown, concentration, utilization), trips circuit breaker if needed |
| Metrics snapshot | 15 min | Generates TWR APY calculation, persists to Firestore |

### Log Monitoring

**Local bot**: Logs go to stdout via Winston logger (structured JSON in production).

**Cloud Functions**: View in Firebase Console or CLI:

```bash
firebase functions:log
firebase functions:log --only checkRebalance
firebase functions:log --only healthCheck
```

**Google Cloud Logging** (for advanced queries):

```bash
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=checkRebalance" --limit=50
```

---

## Emergency Procedures

### Circuit Breaker — Automatic Trip

The circuit breaker trips automatically when:
- TVL drops >= 2% from the recorded peak (`CIRCUIT_BREAKER_DRAWDOWN_PCT`)
- Risk assessment returns level `EMERGENCY`

**What happens on trip:**
1. All rebalancing and compounding halt immediately
2. Emergency withdrawal executes: all funds pulled from Drift, Kamino, Save back to vault idle
3. EMERGENCY alert sent to Discord and Telegram
4. Bot continues running but only performs health checks and rate fetching

### Circuit Breaker — Manual Reset

The circuit breaker **requires manual operator action** to reset. This is intentional.

**Steps:**
1. Investigate the cause (check logs, Solana Explorer, protocol status)
2. Verify vault state and all protocol positions
3. If safe to resume, reset via a one-off script:

```typescript
// reset-circuit-breaker.ts
import { reset } from './bot/engine/circuit-breaker.js';
reset('Investigated drawdown — caused by <reason>. Vault is safe to resume.');
```

Or restart the bot process (circuit breaker state is in-process memory):

```bash
# pm2
pm2 restart eurc-optimizer

# systemd
sudo systemctl restart eurc-optimizer
```

> **Important**: Restarting the bot clears the circuit breaker state (it resets to not-tripped). The peak TVL tracker also resets, so the drawdown calculation starts fresh. Only restart after confirming the vault is safe.

### Manual Emergency Withdrawal

If the bot is down and you need to withdraw all funds manually:

```bash
# Check vault state
solana account <VAULT_ADDRESS> --url mainnet-beta --output json

# Use the Voltr CLI or write a one-off script using VoltrClient:
# client.createWithdrawStrategyIx() for each active strategy
# client.createWithdrawVaultIx() for the user's share
```

### Protocol-Specific Issues

| Scenario | Response |
|----------|----------|
| One protocol is down | Bot skips stale rates, excludes from rebalancing |
| All rates are stale (>10 min old) | Bot halts rebalancing, continues health checks |
| Rate deviates >50% from 7-day MA | Rate rejected by oracle sanity check, protocol excluded |
| Protocol utilization >85% | Bot stops supplying to that protocol |
| RPC node failure | Bot logs errors, retries on next interval |

### Recovery Checklist

After any emergency event:

1. Check bot logs for the root cause
2. Verify vault total value on Solana Explorer
3. Verify each strategy account balance
4. Check protocol health (Drift, Kamino, Save dashboards)
5. Reset circuit breaker (restart bot or run reset script)
6. Monitor first few rebalance cycles after reset
7. Post-mortem: document what happened and update risk parameters if needed

---

## Environment Variable Reference

### Required (Vault Setup Scripts)

| Variable | Description | Example |
|----------|-------------|---------|
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `SOLANA_CLUSTER` | `devnet` or `mainnet-beta` | `mainnet-beta` |
| `VAULT_ADMIN_KEYPAIR_PATH` | Path to admin keypair JSON | `./keys/admin.json` |
| `VAULT_MANAGER_KEYPAIR_PATH` | Path to manager keypair JSON | `./keys/manager.json` |
| `EURC_MINT` | EURC token mint address (omit for devnet USDC) | `HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr` |

### Required (After Vault Creation)

| Variable | Description | Set After |
|----------|-------------|-----------|
| `VAULT_ADDRESS` | On-chain vault pubkey | Step 1: create-vault |
| `DRIFT_STRATEGY_ADDRESS` | Drift strategy PDA | Step 3: init-strategies |
| `KAMINO_STRATEGY_ADDRESS` | Kamino strategy PDA | Step 3: init-strategies |
| `SAVE_STRATEGY_ADDRESS` | Save strategy PDA | Step 3: init-strategies |

### Required (Protocol Config)

| Variable | Description | Default |
|----------|-------------|---------|
| `DRIFT_SPOT_MARKET_INDEX` | Drift EURC spot market index | `54` |
| `DRIFT_ORACLE_ADDRESS` | Drift EURC oracle pubkey | _(none)_ |
| `KAMINO_RESERVE_ADDRESS` | Kamino kLend EURC reserve | `EGPE45iPkme8G8C1xFDNZoZeHdP3aRYtaAfAQuuwrcGZ` |
| `SAVE_RESERVE_ADDRESS` | Save (Solend) EURC reserve | `ECNduHkbaQL5mgNenGCwYhXtdv4tqVjeRcCYwUeQQHc1` |
| `SAVE_LENDING_MARKET` | Save EURC lending market | `4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY` |
| `SAVE_COUNTERPARTY_TA` | Save EURC supply token account | _(required for Save strategy)_ |
| `SAVE_COLLATERAL_MINT` | Save EURC collateral mint | _(required for Save strategy)_ |
| `SAVE_PYTH_ORACLE` | Save EURC Pyth oracle | _(optional)_ |
| `SAVE_SWITCHBOARD_ORACLE` | Save EURC Switchboard oracle | _(optional)_ |

### Optional (Bot Tuning)

| Variable | Description | Default |
|----------|-------------|---------|
| `REBALANCE_MIN_SPREAD_BPS` | Minimum spread to trigger rebalance | `50` (0.5%) |
| `MAX_ALLOCATION_PCT` | Maximum allocation to any single protocol | `70` (70%) |
| `MIN_ALLOCATION_PCT` | Minimum allocation to any active protocol | `10` (10%) |
| `IDLE_RESERVE_PCT` | Idle reserve for withdrawal liquidity | `5` (5%) |
| `REBALANCE_COOLDOWN_MS` | Minimum time between rebalances | `1800000` (30 min) |
| `COMPOUND_MIN_AMOUNT` | Minimum accrued interest before compounding (atoms) | `10000000` (10 EURC) |
| `CIRCUIT_BREAKER_DRAWDOWN_PCT` | Max drawdown before circuit breaker trips | `2` (2%) |
| `COMPUTE_UNIT_LIMIT` | Compute units for vault transactions | `400000` |
| `PRIORITY_FEE_MICRO_LAMPORTS` | Priority fee for transactions | `5000` |

### Optional (Firebase)

| Variable | Description |
|----------|-------------|
| `FIREBASE_PROJECT_ID` | Firebase project ID (enables Firestore metrics persistence) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase service account JSON |

### Optional (Alerts)

| Variable | Description |
|----------|-------------|
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for alerts |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `TELEGRAM_CHAT_ID` | Telegram chat/group ID |

### Frontend Only (`ranger/app/.env.local`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC for frontend | Yes |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | Cluster name | Yes |
| `NEXT_PUBLIC_VAULT_ADDRESS` | Vault address for deposit page | No (app works without it) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key | No (enables real-time data) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | No |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | No |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | No |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | No |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | No |

---

## Deployment Order Summary

```
1. npm run create-vault        → set VAULT_ADDRESS in .env
2. npm run add-adaptors        → registers Drift, Kamino, Save adaptors
3. npm run init-strategies     → set DRIFT/KAMINO/SAVE_STRATEGY_ADDRESS in .env
4. npm run seed-deposit        → initial EURC deposit to bootstrap vault
5. firebase deploy --only functions   → Cloud Functions (scheduled bot tasks)
6. npm run bot                        → local bot (optional alongside Functions)
7. cd ranger/app && npm run build     → static export
8. firebase deploy --only hosting     → frontend goes live
```

Total deployment time (excluding wallet funding): ~15 minutes.

---

_Last updated: March 2026_

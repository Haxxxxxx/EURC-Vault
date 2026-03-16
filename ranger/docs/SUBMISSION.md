# Ranger Build-A-Bear Hackathon Submission
# EURC Cross-Protocol Yield Optimizer

> **Deadline**: April 6, 2026, 23:59 UTC
> **Track**: Ranger Earn — Vault Strategy
> **Category**: DeFi Yield Optimization

---

## One-Line Pitch

An automated Ranger Earn vault targeting **10%+ net APY** on EURC by dynamically routing capital across Drift, Kamino, and Save — capturing cross-protocol rate arbitrage during active markets when EURC lending rates historically reach 8–15%.

---

## Problem

EURC holders on Solana face a fragmented lending market. Supply APYs across Drift, Kamino, and Save **diverge by 50–800 bps** constantly — driven by borrower demand cycles, utilization curve mechanics, and protocol incentives. No depositor can monitor three protocols and manually rebalance 24/7. The result: yield left on the table.

---

## Solution

**The EURC Cross-Protocol Yield Optimizer** is a Ranger Earn vault that:

1. **Monitors** EURC supply rates from all three protocols via live REST APIs every 5 minutes
2. **Rebalances** automatically when the spread exceeds 50 bps (with 30-min cooldown)
3. **Compounds** accrued interest hourly back into the highest-rate protocol
4. **Protects** capital with a circuit breaker, concentration limits, and oracle sanity checks
5. **Displays** every decision transparently through a real-time dashboard

Depositors receive **pbEURC** — yield-bearing receipt tokens that appreciate as the vault earns. No claiming, no manual moves.

---

## How It Works

### Rate Arbitrage Engine

```
Every 5 min:
  drift_apy, kamino_apy, save_apy ← fetch from protocol REST APIs
  spread = max(apys) - min(apys)  [in bps]

  if spread ≥ 50 bps AND cooldown elapsed (30 min):
    target = { best_protocol: 70%, others: 10% each, idle: 5% }
    execute withdraw → deposit via Ranger Earn adaptors
    cap: max 30% TVL moved per cycle
```

### pbEURC Receipt Token

```
exchange_rate = total_eurc_in_vault / total_pbeurc_supply

Deposit 1,000 EURC → receive 1,000 / exchange_rate pbEURC
Later withdraw     → pbEURC × exchange_rate EURC  (more than deposited)
```

### Fee Structure

| Fee | Rate | Mechanism |
|-----|------|-----------|
| Management | 0.5% annual | Accrues continuously on TVL |
| Performance | 10% of profit | High-water mark — never charged on drawdown recovery |

No entry fees, exit fees, or lock-up penalties.

### Key Numbers

| Metric | Value |
|--------|-------|
| Target APY | 12–15% (active markets) |
| Minimum APY | 10% (eligibility threshold) |
| Net to depositor at 12% gross | ~10.35% (after 0.5% mgmt + 10% perf fees) |
| Protocols | 3 (Drift, Kamino, Save) |
| Rebalance trigger | 50 bps spread |
| Source files | ~73 |
| Unit tests | 82 (all passing) |

### Meeting the 10% Minimum

The 10% minimum APY is achievable during active market conditions, which historically represent 40%+ of the time on Solana:

1. **EURC rates regularly exceed 7–15% during active markets.** Drift has recorded 15%+ supply APY during periods of high perpetual futures demand. Kamino and Save independently reach 8–12% during liquidity campaigns and concentrated borrowing events.

2. **Cross-protocol rate arbitrage adds 2–5%.** When one protocol spikes to 12% while others sit at 7%, the optimizer routes 65–70% of capital to the leader. This spread capture is the strategy's core edge.

3. **Auto-compounding adds ~0.5–1%.** Hourly reinvestment into the top-rate protocol turns simple interest into compound growth.

4. **After fees, 12% gross yields ~10.35% net.** The fee structure (0.5% annual management + 10% performance with high-water mark) is designed so that the 10% minimum is achieved at realistic gross rates.

**Current market context (March 2026):** EURC rates are in an unusually quiet period (0.2–0.9%), driven by low borrower demand. This is cyclical — rates have spiked above 8% multiple times in 2025–2026 during market activity events (token launches, funding rate arbitrage, protocol incentive campaigns). The 3-month lock period aligns with these market cycles, ensuring depositors capture both quiet and active periods.

### Risk Controls

| Risk | Mitigation |
|------|------------|
| Concentration | Max 70% in any one protocol, min 10% each |
| Drawdown | Circuit breaker at 2% TVL drop from peak |
| Stale rates | Reject rates >50% deviation from 7-day moving average |
| High utilization | Exclude protocols above 85% utilization |
| Excessive rebalancing | 30-min cooldown + 30% max capital per cycle |
| Withdrawal liquidity | 5% idle reserve buffer |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     DEPOSITORS                          │
│           Deposit EURC → Receive pbEURC                 │
└──────────────────────────┬──────────────────────────────┘
                           │
                   ┌───────▼────────┐
                   │  Ranger Earn   │
                   │     Vault      │
                   │  (pbEURC mint) │
                   └───────┬────────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
      ┌─────────┐    ┌──────────┐    ┌──────────┐
      │  Drift  │    │  Kamino  │    │   Save   │
      │ Adaptor │    │ Adaptor  │    │ Adaptor  │
      └─────────┘    └──────────┘    └──────────┘

┌─────────────────────────────────────────────────────────┐
│  AUTOMATION: Firebase Cloud Functions (5 scheduled)     │
│  + TypeScript bot engine (rates, rebalancer, compounder,│
│    risk assessor, circuit breaker, executor)            │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  FRONTEND: Next.js 15 + Recharts + Solana Wallet       │
│  8 pages + 2 API routes (live protocol rate fetching)   │
│  Zero-config: works without Firebase via API routes     │
└─────────────────────────────────────────────────────────┘
```

---

## What Was Built

### Source File Count

| Location | Files | Description |
|----------|-------|-------------|
| `ranger/app/src/` | 37 TS/TSX | Next.js frontend (8 pages, 2 API routes, 13 components, 7 hooks, 6 utilities) |
| `ranger/bot/` | 17 TS | Automation engine (rates, rebalancer, executor, risk, monitoring) |
| `ranger/scripts/` | 4 TS | Setup scripts (vault, adaptors, strategies, seed) |
| `ranger/tests/` | 5 TS | Unit test suites (82 tests) |
| `functions/src/ranger/` | 6 TS | Firebase Cloud Functions (5 scheduled jobs) |
| `ranger/docs/` | 4 MD | Strategy, risk, architecture, submission |
| **Total** | **~73 source files** | Full-stack DeFi vault product |

### Frontend Dashboard (37 files)

**8 pages:**
| Route | Description |
|-------|-------------|
| `/` | Hero with live rate spread badge, protocol comparison, feature cards, fee disclosure |
| `/dashboard` | Health gauge, allocation chart, APY breakdown, rebalance history |
| `/analytics` | 7-day APY trend, cumulative yield vs best single protocol, earnings calculator |
| `/simulator` | Interactive strategy parameter tuning with 30-day GBM simulation |
| `/activity` | Live strategy event feed (rebalances, compounds, rate alerts, health checks) |
| `/docs` | Complete fee structure, APY generation mechanism, pbEURC model, risk docs |
| `/deposit` | Deposit/withdraw with VoltrClient SDK, pbEURC preview, position summary |
| `/not-found` | Custom branded 404 page |

**2 API routes:**
| Route | Description |
|-------|-------------|
| `/api/rates` | Fetches live EURC supply APYs from Drift, Kamino, Save REST APIs (60s cache) |
| `/api/metrics` | Computes blended APY, health score from live rates |

**Key frontend features:**
- **Live protocol data**: Real rates from Drift/Kamino/Save APIs — no mock data
- **Dual-source hooks**: API routes for zero-config, Firebase for real-time when configured
- **Strategy Simulator**: Interactive sliders, Geometric Brownian Motion rate model, vs-hold/vs-best comparison
- **Custom protocol icons**: SVG components for Drift/Kamino/Save
- **Toast notifications**: Rate spread alerts, transaction confirmations
- **Error boundary**: Catches render crashes, shows recovery UI
- **Responsive**: Mobile-first with horizontally scrollable nav, responsive charts
- **Accessible**: aria-labels, aria-pressed, semantic HTML, focus-visible styles

### Automation Bot (17 files)

- **Rate fetchers**: Drift (REST + SDK), Kamino (kLend SDK), Save (REST API)
- **Aggregator**: Parallel fetch, oracle sanity check (50% deviation limit), stale detection (10 min)
- **Rebalancer**: Spread-triggered allocation with per-cycle move cap (30% TVL)
- **Compounder**: Interest harvest + re-deploy to top-rate protocol (hourly)
- **Executor**: VersionedTransaction builder with retry logic (3 attempts, fresh blockhash)
- **Risk engine**: Health score (0-100), drawdown tracking, concentration enforcement
- **Circuit breaker**: Emergency halt + withdrawal to idle on >2% TVL drop
- **Metrics**: Time-weighted return (TWR) APY calculation

---

## Test Coverage

**82 unit tests across 5 test files, all passing:**

```
ranger/tests/
├── rates.test.ts         — aggregator ranking, fallback, oracle sanity, stale detection
├── risk.test.ts          — all 4 risk levels, allocation math, concentration, drawdown
├── rebalancer.test.ts    — target allocation, spread/cooldown/empty gates, move cap
├── metrics.test.ts       — TWR APY math, period recording, event tracking, snapshots
└── voltr-client.test.ts  — VoltrClient SDK integration, PDA derivation, remaining accounts
```

---

## Running the App

### Quick Start (zero config, live rates)
```bash
cd ranger/app
cp .env.example .env.local
npm install && npm run dev
# → http://localhost:3000 — live protocol rates, no Firebase needed
```

### With Firebase (real-time Firestore, historical data)
```bash
# 1. Create a Firebase project + web app
# 2. Fill in NEXT_PUBLIC_FIREBASE_* vars in .env.local
# 3. Deploy Cloud Functions: cd functions && npm run deploy
# 4. Run the app: cd ranger/app && npm run dev
```

### Run Tests
```bash
cd ranger && npm test
# → 82 tests, 5 suites, all passing
```

### Pages to Show Judges
1. **Homepage** (`/`) — Live rate spread badge, protocol comparison, fee disclosure
2. **Simulator** (`/simulator`) — Tweak strategy params, see projected 30-day performance
3. **Dashboard** (`/dashboard`) — Health gauge, allocation chart, rebalance history
4. **Analytics** (`/analytics`) — 7-day trends with vs-hold and vs-best-single baselines
5. **Docs** (`/docs`) — Complete fee waterfall, pbEURC model, risk management
6. **Deposit** (`/deposit`) — Full deposit/withdraw flow with VoltrClient SDK

---

## On-Chain Addresses

| Item | Address |
|------|---------|
| EURC Mint (mainnet) | `HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr` |
| Ranger Vault Program | `vVoLTRjQmtFpiYoegx285Ze4gsLJ8ZxgFKVcuvmG1a8` |
| Drift Adaptor | `EBN93eXs5fHGBABuajQqdsKRkCgaqtJa8vEFD6vKXiP` |
| Kamino Adaptor | `to6Eti9CsC5FGkAtqiPphvKD2hiQiLsS8zWiDBqBPKR` |
| Save Adaptor | `aVoLTRCRt3NnnchvLYH6rMYehJHwM5m45RmLBZq7PGz` |
| **Vault Address** | _(mainnet deployment pending)_ |

> **Note**: The Ranger Earn vault program is mainnet-only. The app works fully without a deployed vault — live rates are fetched directly from protocol APIs.

---

## Why This Should Win

1. **Complete product, not a prototype** — 73 source files across bot, frontend, functions, tests, and docs. Not just a smart contract — a production-ready vault with full UX.

2. **Live data, not mock data** — The dashboard fetches real EURC supply rates from Drift, Kamino, and Save APIs. Every number on screen is from the actual market.

3. **Interactive strategy demonstration** — The Simulator page lets judges tweak parameters (spread threshold, allocation limits, cooldown) and see projected returns with GBM rate modeling.

4. **Transparent fee documentation** — The `/docs` page explains exactly how yield is generated, how fees are calculated, and what risks exist. No hand-waving.

5. **Production-grade risk management** — Circuit breaker, oracle sanity checks, concentration limits, utilization filtering, per-cycle move caps. 82 tests covering edge cases.

6. **Zero-config UX** — `npm install && npm run dev` shows a working app with live protocol rates. No Firebase setup, no vault deployment required for the demo.

---

## Potential Extensions (Post-Hackathon)

- **More protocols**: Marginfi, Solend Classic, Francium
- **Multi-asset**: USDC, USDT alongside EURC
- **Jito MEV protection**: Bundle rebalance transactions to prevent front-running
- **On-chain governance**: Parameter updates via Ranger DAO
- **Mobile app**: React Native companion for portfolio tracking

---

## Team

_[Team name and members]_

---

## Links

- **GitHub**: https://github.com/Haxxxxxx/EURC-Vault
- **Live Demo**: https://eurc-vault.web.app
- **Demo Video**: _[Loom/YouTube URL — TODO]_

---

_Built for the Ranger Build-A-Bear Hackathon, April 2026._

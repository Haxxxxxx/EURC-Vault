# Ranger Build-A-Bear Hackathon — Final Prep Guide
# EURC Cross-Protocol Yield Optimizer
# Deadline: April 6, 2026, 23:59 UTC

---

## Submission Checklist

| # | Deliverable | Status | Notes |
|---|-------------|--------|-------|
| 1 | Demo/Pitch Video (max 3 min) | NOT STARTED | Record with Loom or OBS |
| 2 | Strategy Documentation | DONE | `ranger/docs/strategy.md`, `risk-management.md` |
| 3 | Code Repository | NEEDS PUSH | Branch `feature/ranger-hackathon` ready, no remote set |
| 4 | On-chain Verification | BLOCKED | Voltr program is mainnet-only, devnet wallets funded |
| 5 | SUBMISSION.md | NEEDS POLISH | Team name, GitHub URL, video link are placeholders |

---

## Judging Criteria & How We Score

### 1. Strategy Quality & Edge (Weight: High)
**What judges want**: Genuine alpha, defensible thesis, not a toy.

**Our pitch**: EURC lending rates diverge 50-800 bps across Drift/Kamino/Save due to different utilization curves, borrower demand cycles, and incentive programs. We capture this spread automatically.

**Current score: 8/10**
- Strong thesis grounded in real market dynamics
- Clear parameters (50bps trigger, 70% max concentration, 30min cooldown)
- Target APY 12-15% is ambitious but argued with real rate data

**To improve**:
- [ ] Add a real rate snapshot showing actual divergence (screenshot from Drift/Kamino/Save dashboards)
- [ ] Include historical rate comparison data in the demo video

### 2. Risk Management (Weight: High)
**What judges want**: Drawdown limits, liquidation protection, position sizing, rebalancing logic.

**Current score: 9/10**
- Circuit breaker at 2% drawdown from peak
- Oracle sanity check (reject >50% deviation from 7-day MA)
- Per-cycle move cap (30% max capital moved)
- Concentration limits (max 70%, min 10%)
- Utilization filter (exclude >85% utilized protocols)
- 5% idle reserve for instant withdrawals

**To improve**:
- [ ] Fix circuit breaker drawdown logging bug (Sprint 4)
- [ ] Demo the circuit breaker in the video (show what happens when a protocol crashes)

### 3. Technical Implementation (Weight: High)
**What judges want**: Code quality, adaptor integration, vault architecture, security.

**Current score: 7/10**
- 68 source files across bot, frontend, functions, scripts
- Real VoltrClient SDK integration (not mocked SDK calls)
- 82 unit tests passing
- TypeScript strict mode, ESM, conventional commits
- Protocol-specific remaining accounts for all 3 adaptors

**To improve**:
- [ ] Wire vault-reader into bot main loop (Sprint 4)
- [ ] Fix sendWithRetry stale blockhash (Sprint 4)
- [ ] Push to GitHub so judges can review code

### 4. Production Viability (Weight: Medium)
**What judges want**: Realistic deployment path, scalability, operational complexity.

**Current score: 7/10**
- Firebase Cloud Functions for scheduling (production-grade infra)
- Firestore for state + metrics (scalable, managed)
- Bot architecture separates rate fetching, decision, execution
- Manager keypair via env/secrets (not hardcoded)

**To improve**:
- [ ] Add Firestore TTL policy for rate history (prevent unbounded growth)
- [ ] Document the mainnet deployment path in SUBMISSION.md
- [ ] Mention Jito bundle protection as post-hackathon MEV mitigation

### 5. Novelty & Innovation (Weight: Medium)
**What judges want**: New primitives, creative protocol combinations, ecosystem contributions.

**Current score: 6/10**
- Cross-protocol arbitrage is the novel angle (most vaults target one protocol)
- pbEURC receipt token model is clean
- Full-stack: on-chain + bot + dashboard is rare for hackathon submissions

**To improve**:
- [ ] Emphasize the "rate arbitrage" angle — no other Ranger vault does this
- [ ] Mention EURC specifically (euro stablecoin) — smaller market = bigger spreads = more alpha
- [ ] Highlight the 3-protocol diversification vs single-protocol risk

---

## Frontend UX — Current State (March 14 Update)

### Completed
- 8 pages + 2 API routes, all production-ready
- Live protocol rates from Drift/Kamino/Save REST APIs (no mock data)
- Strategy Simulator with interactive parameter tuning
- Full /docs page with fee structure, pbEURC model, risk docs
- Custom SVG protocol icons (Drift/Kamino/Save)
- Toast notifications (rate alerts, tx confirmations)
- Error boundary + vault error state handling
- OG meta, Twitter cards, SEO keywords
- "vs Holding EURC" baseline on analytics charts
- "vs Best Single Protocol" comparison on cumulative yield chart
- Footer component on key pages
- Custom 404 page
- Mobile-responsive navbar (horizontally scrollable)
- Skeleton loading states on all data sections
- Page-specific browser titles
- Centralized fee constants, explorer URLs, allocation logic

---

## Demo Video Script (3 minutes max)

### Opening (0:00-0:20) — The Problem
"EURC holders on Solana face a choice: Drift, Kamino, or Save for lending yield. But rates diverge constantly — sometimes by 800 basis points. Nobody can monitor and rebalance 24/7."

### The Solution (0:20-0:50) — Show Landing Page
"The EURC Cross-Protocol Yield Optimizer is a Ranger Earn vault that automatically chases the highest yield across all three protocols."
- Show landing page hero
- Point to live rate comparison (highlight the spread)
- Click "View Dashboard"

### Dashboard Deep Dive (0:50-1:30) — Show Dashboard
"Here's the bot in action."
- Health gauge: "Health score monitors drawdown, concentration, rate staleness"
- Allocation chart: "Capital is deployed across protocols based on current rates"
- APY breakdown: "Each protocol's rate, utilization, and our allocation"
- Rebalance history: "The bot rebalanced 4 times today — here's each decision with the spread that triggered it"

### Analytics (1:30-2:00) — Show Analytics
"Over 7 days, you can see how rates fluctuate and our blended APY tracks the best opportunities."
- APY trend chart: "Blue is Drift, purple is Kamino, green is Save, the white dashed line is our blended return"
- Earnings calculator: "A 10,000 EURC deposit at current rates would earn X over 3 months"

### Risk Management (2:00-2:20) — Show Deposit Page
"Capital protection is built in."
- "Circuit breaker halts everything if TVL drops 2% from peak"
- "Oracle checks reject stale or manipulated rate data"
- "Max 70% in any single protocol"
- Show deposit flow: input amount → pbEURC preview → fee disclosure

### Technical (2:20-2:50) — Code Walkthrough (quick)
"Under the hood:"
- Show `executor.ts`: "Real VoltrClient SDK calls — withdraw from underperformer, deposit into top protocol"
- Show `rebalancer.ts`: "Spread-triggered allocation engine with per-cycle move caps"
- Show test output: "82 unit tests covering rate edge cases, risk scenarios, and allocation math"

### Close (2:50-3:00)
"EURC Cross-Protocol Yield Optimizer — automated rate arbitrage on Ranger Earn. 12-15% APY target, 82 tests, production-ready architecture."

---

## On-Chain Verification Strategy

The Voltr vault program is **mainnet-only** — devnet deployment is impossible. Options:

### Option A: Mainnet Deployment (Ideal but Risky)
- Deploy vault on mainnet with real EURC
- Seed with small amount (100 EURC)
- Run bot for a few hours to generate real rebalance tx signatures
- **Risk**: Real money, real transactions, need mainnet EURC

### Option B: Document the Gap (Current Approach)
- Show devnet wallet addresses (funded, verified)
- Show `create-vault` script output (fails at program call, not at our code)
- Explain: "Voltr program is mainnet-only, our code is correct and ready"
- Show all scripts + bot running in simulation mode
- Let code quality + strategy + frontend carry the submission

### Option C: Use Voltr Devnet (If Available)
- Check if Ranger team has a devnet deployment
- Ask in Ranger Discord if there's a devnet vault program
- If yes, deploy there

**Recommendation**: Try Option C first (ask Ranger Discord). Fall back to Option B with strong documentation.

---

## Git & Repo Setup

### Current State
- All code on `feature/ranger-hackathon` branch
- 9 commits with conventional messages
- No remote configured

### Before Submission
- [ ] Create GitHub repo (public, named `eurc-yield-optimizer` or keep `EURC-Vault`)
- [ ] Add remote: `git remote add origin <url>`
- [ ] Push: `git push -u origin feature/ranger-hackathon`
- [ ] Consider: merge to main or submit as feature branch?
- [ ] Add `@jakeyvee` as collaborator (if private repo)
- [ ] Update SUBMISSION.md with repo URL

---

## Remaining Work — Priority Order

### Must Do (Before April 6)
1. **Push to GitHub** — Create repo, push branch
2. **Demo video** — Record 3-minute Loom walkthrough
3. **SUBMISSION.md** — Fill in team name, GitHub URL, video link
4. **Fresh clone test** — Verify `npm install && npm run dev` works from scratch

### Should Do (High Impact)
5. **Deploy to Vercel** — Live demo URL for judges
6. **Wire Firebase** — Deploy Cloud Functions for real-time historical data
7. **Mainnet vault deployment** — If possible (Voltr is mainnet-only)

### Nice to Have (If Time)
8. **Bundle optimization** — Lazy load Recharts on heavy pages
9. **Lighthouse audit** — Performance, accessibility, SEO scores
10. **README cleanup** — Add screenshots of each page

---

## Key Files Quick Reference

| Purpose | Path |
|---------|------|
| Landing page | `ranger/app/src/app/page.tsx` |
| Dashboard | `ranger/app/src/app/dashboard/page.tsx` |
| Analytics | `ranger/app/src/app/analytics/page.tsx` |
| Deposit/Withdraw | `ranger/app/src/app/deposit/page.tsx` |
| Navbar | `ranger/app/src/components/layout/Navbar.tsx` |
| Rate comparison component | `ranger/app/src/components/dashboard/RateComparison.tsx` |
| Health gauge | `ranger/app/src/components/dashboard/HealthGauge.tsx` |
| Allocation chart | `ranger/app/src/components/dashboard/AllocationChart.tsx` |
| APY trend chart | `ranger/app/src/components/analytics/ApyTrendChart.tsx` |
| Earnings calculator | `ranger/app/src/components/analytics/EarningsCalculator.tsx` |
| Bot executor | `ranger/bot/engine/executor.ts` |
| Bot rebalancer | `ranger/bot/engine/rebalancer.ts` |
| Circuit breaker | `ranger/bot/engine/circuit-breaker.ts` |
| Bot entry point | `ranger/bot/index.ts` |
| Vault reader | `ranger/bot/engine/vault-reader.ts` |
| Strategy docs | `ranger/docs/strategy.md` |
| Risk docs | `ranger/docs/risk-management.md` |
| Submission | `ranger/docs/SUBMISSION.md` |
| Tests | `ranger/tests/` (5 files, 82 tests) |
| Firebase functions | `functions/src/ranger/` (6 files) |
| Config | `ranger/bot/config.ts` |
| Hackathon requirements | `.ralph/specs/hackathon-requirements.md` |

---

## Timeline to Deadline

| Date | Task |
|------|------|
| Mar 13 (Today) | Sprint 4 fixes (Ralph), push to GitHub |
| Mar 14-15 | Frontend polish (favicon, branding, mock data refresh, tooltips) |
| Mar 16-20 | Wire Firebase live data (even partial), test all flows |
| Mar 21-30 | Record demo video, iterate on presentation |
| Apr 1-5 | Final polish, review SUBMISSION.md, test fresh clone setup |
| Apr 6 | SUBMIT before 23:59 UTC |

---

_Last updated: March 13, 2026_

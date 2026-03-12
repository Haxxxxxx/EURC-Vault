# EURC Vault - Web Dashboard

Premium fintech glassmorphic dashboard for EURC staking on Solana blockchain.

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS 4**
- **Solana** (@solana/wallet-adapter-react, @solana/web3.js, @coral-xyz/anchor)
- **Framer Motion** (micro-interactions)
- **Lucide React** (icons)
- **next-themes** (dark/light mode)
- **Inter font** (Google Fonts)

## Features

- 🔐 **Wallet Integration** - Phantom, Solflare wallet support
- 💰 **Staking Vaults** - Multiple vault options with different APY rates
- 📊 **Portfolio Overview** - Real-time portfolio value and rewards tracking
- ⏱️ **Epoch Countdown** - Live countdown to epoch end with animated timer
- 🔄 **Withdrawal System** - Cooldown period management with status tracking
- 📜 **Transaction History** - Comprehensive history with filters
- 🎨 **Glassmorphic Design** - Modern dark-first UI with light mode support
- ✨ **Micro-interactions** - Smooth animations and transitions

## Design System

### Color Palette

**Dark Mode (default):**
- Background: `#0A0E1A` (deep navy)
- Surface: `#141929` (slate)
- Glass: `rgba(255,255,255,0.05)` with backdrop-blur
- Accent: `#003399` (European Blue)

**Light Mode:**
- Background: `#F5F3EF` (Alabaster)
- Surface: `#FFFFFF`
- Glass: `rgba(255,255,255,0.7)` with backdrop-blur

### Typography

- Font: Inter (200-600 weights)
- Large balances: font-weight 200, 48-64px
- Labels: font-weight 300
- Body: font-weight 400
- Headers: font-weight 500

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Solana wallet (Phantom or Solflare)

### Installation

```bash
cd app
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```env
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_DEVNET=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_RPC_MAINNET=https://api.mainnet-beta.solana.com
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

### Type Check

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── page.tsx           # Portfolio overview
│   ├── vaults/
│   │   ├── page.tsx       # Vault listing
│   │   └── [id]/page.tsx  # Vault detail
│   ├── history/page.tsx   # Transaction history
│   └── settings/page.tsx  # Settings
├── components/
│   ├── ui/                # Base UI components
│   ├── layout/            # Layout components
│   ├── portfolio/         # Portfolio components
│   ├── vault/             # Vault components
│   ├── shared/            # Shared components
│   └── history/           # History components
├── hooks/                 # React hooks
├── lib/                   # Utilities and constants
└── providers/             # Context providers
```

## Key Components

### GlassCard
Reusable glassmorphic container with hover effects and configurable padding.

### VaultCard
Displays vault preview with APY, capacity bar, and stats.

### DepositPanel / WithdrawPanel
Handles deposit and withdrawal flows with projected earnings and cooldown management.

### EpochCountdown
Live countdown timer with pulse animation on seconds.

### AnimatedNumber
Smooth number transitions using react-spring.

## Mock Data

Currently uses mock data for development. Hooks are structured to be easily replaced with actual on-chain queries:

- `useVault()` - Fetch vault configuration
- `useUserStake()` - Fetch user stake data
- `useUserPortfolio()` - Fetch user portfolio
- `useEpochCountdown()` - Live epoch countdown

## Deployment

The app can be deployed to Vercel, Netlify, or any platform supporting Next.js 15:

```bash
npm run build
```

Ensure environment variables are configured in your deployment platform.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

Proprietary - All rights reserved

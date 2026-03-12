# EURC Vault Dashboard - Installation Guide

## Quick Start

```bash
cd /Users/charlesvincent/Desktop/GitHub/EURC-Vault/app
npm install --legacy-peer-deps
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Requirements

- Node.js 18+ (tested with v18+)
- npm 9+
- Solana wallet browser extension (Phantom or Solflare)

## Installation Steps

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

Note: `--legacy-peer-deps` is required due to React 19 compatibility with Solana wallet adapters.

### 2. Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` if needed (defaults should work for devnet):

```env
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_DEVNET=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_RPC_MAINNET=https://api.mainnet-beta.solana.com
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at:
- Local: http://localhost:3000
- Network: http://10.0.0.100:3000 (your local IP)

### 4. Build for Production

```bash
npm run build
npm start
```

## Verification

After running `npm run dev`, you should see:

```
✓ Ready in 2-3s
```

Open http://localhost:3000 and you should see:
- Dark-themed glassmorphic dashboard
- "Connect Wallet" prompt (if no wallet connected)
- Portfolio overview with vault cards (if wallet connected)

## Troubleshooting

### Issue: Module not found errors

**Solution**: Ensure you used `--legacy-peer-deps`:
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Issue: Tailwind CSS errors

**Solution**: Clear Next.js cache:
```bash
rm -rf .next
npm run dev
```

### Issue: Wallet connection fails

**Solutions**:
1. Install Phantom or Solflare wallet extension
2. Check browser console for errors
3. Verify RPC endpoint in `.env.local`

### Issue: TypeScript errors

**Solution**: Run type check:
```bash
npm run typecheck
```

### Issue: Port 3000 already in use

**Solution**: Kill existing process or use different port:
```bash
lsof -ti:3000 | xargs kill -9
# or
PORT=3001 npm run dev
```

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (port 3000) |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run typecheck` | Check TypeScript types |
| `npm run lint` | Run ESLint |
| `npm install --legacy-peer-deps` | Install dependencies |

## Browser Extensions Required

Install one of these Solana wallet extensions:

- **Phantom**: https://phantom.app/
- **Solflare**: https://solflare.com/

## Network Configuration

The app defaults to **devnet** for testing. To switch to mainnet:

1. Edit `.env.local`:
   ```env
   NEXT_PUBLIC_NETWORK=mainnet
   ```

2. Restart dev server:
   ```bash
   npm run dev
   ```

## Mock Data

Currently, all data is mocked. The app will display:
- 3 vault options (Standard, Premium, Enterprise)
- Mock user balances and stakes
- Sample transaction history

To integrate with actual on-chain data, see `PROJECT_SUMMARY.md` section "Next Steps for Production".

## Development Workflow

1. Make changes to files in `src/`
2. Hot reload will update the browser automatically
3. Check browser console for any errors
4. Run `npm run typecheck` before committing

## Production Deployment

For Vercel (recommended):

```bash
vercel deploy
```

Or manual build:

```bash
npm run build
# Upload .next/ folder to hosting
```

Ensure environment variables are set in your hosting platform dashboard.

## Support

- Check `README.md` for architecture details
- See `PROJECT_SUMMARY.md` for complete file listing
- Review component source code for implementation details

## Success Indicators

You know it's working when you see:

1. ✅ No errors in terminal
2. ✅ http://localhost:3000 loads
3. ✅ Dark glassmorphic UI appears
4. ✅ Can click "Connect Wallet" button
5. ✅ Vault cards display with APY percentages
6. ✅ Epoch countdown timer updates every second
7. ✅ Can navigate between pages (Portfolio, Vaults, History, Settings)
8. ✅ Theme toggle works (dark/light)

## Next Steps

1. ✅ **Installation** - You are here
2. Connect Solana wallet in browser
3. Click through the UI to explore features
4. Review code to understand architecture
5. Integrate with Anchor program (see PROJECT_SUMMARY.md)
6. Test on devnet with real transactions
7. Deploy to production

---

**Current Status**: Dev server ready for local development
**Network**: Devnet (default)
**Data**: Mock data (no chain connection yet)

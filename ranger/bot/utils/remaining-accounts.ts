/**
 * remaining-accounts.ts — Protocol-specific remainingAccounts builders.
 *
 * Each Ranger Earn adaptor instruction requires a set of protocol-specific
 * accounts passed as `remainingAccounts`. This module encapsulates the PDA
 * derivation and account resolution logic for each supported protocol.
 *
 * Supported protocols:
 *   - Save (Solend) via LENDING_ADAPTOR
 *   - Drift spot lending via LENDING_ADAPTOR
 *   - Kamino kLend via KAMINO_ADAPTOR
 *
 * References:
 *   - https://github.com/voltrxyz/lend-scripts
 *   - https://github.com/voltrxyz/kamino-scripts
 */

import {
  PublicKey,
  Connection,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  type AccountMeta,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import BN from 'bn.js';
import {
  LENDING_ADAPTOR_PROGRAM_ID,
  SEEDS,
  VoltrClient,
} from '@voltr/vault-sdk';
import { getSingleReserve, DEFAULT_KLEND_PROGRAM_ID } from '@kamino-finance/klend-sdk';
import { createWithSeedSync } from '@coral-xyz/anchor/dist/cjs/utils/pubkey.js';

// ─── Protocol Program IDs ─────────────────────────────────────────────────────

const SAVE_PROGRAM_ID    = new PublicKey('So1endDq2YkqhipRh3WViPa8hdiSpxWy6z3Z6tMCpAo');
const DRIFT_PROGRAM_ID   = new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH');
const DRIFT_STATE_PUBKEY = new PublicKey('5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN');
const KLEND_PROGRAM_ID   = new PublicKey(DEFAULT_KLEND_PROGRAM_ID);
/** Hubble/Kamino farms program (FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr) */
const FARMS_PROGRAM_ID   = new PublicKey('FarmsPZpWu9i7Kky8tPN37rs2TpmMrAZrC7S7vJa91Hr');

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Derive the ATA address for a given owner + mint (avoids broken spl-token re-exports under NodeNext) */
function findAta(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

// ─── SAVE (Solend) ────────────────────────────────────────────────────────────

/**
 * Derive the strategy PDA for a Save/Solend reserve.
 *
 * @param counterPartyTa  The reserve's liquidity supply token account address.
 *                        For EURC this comes from env (SAVE_COUNTERPARTY_TA).
 */
export function getSaveStrategyPDA(counterPartyTa: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.STRATEGY, counterPartyTa.toBuffer()],
    LENDING_ADAPTOR_PROGRAM_ID,
  )[0];
}

/** Save lending market authority PDA */
function saveLendingMarketAuthority(lendingMarket: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [lendingMarket.toBytes()],
    SAVE_PROGRAM_ID,
  )[0];
}

/** Save obligation — derived with createWithSeed pattern */
function saveObligation(
  vaultStrategyAuth: PublicKey,
  lendingMarket: PublicKey,
): PublicKey {
  return createWithSeedSync(
    vaultStrategyAuth,
    lendingMarket.toBase58().slice(0, 32),
    SAVE_PROGRAM_ID,
  );
}

export interface SaveInitParams {
  vault: PublicKey;
  strategy: PublicKey;
  lendingMarket: PublicKey;  // env: SAVE_LENDING_MARKET
  collateralMint: PublicKey; // env: SAVE_COLLATERAL_MINT
  vc: VoltrClient;
}

/**
 * RemainingAccounts for `createInitializeStrategyIx` (Save/Solend).
 * Does NOT require a network call.
 */
export function getSaveInitRemainingAccounts(params: SaveInitParams): AccountMeta[] {
  const { vault, strategy, lendingMarket, vc } = params;
  const { vaultStrategyAuth } = vc.findVaultStrategyAddresses(vault, strategy);
  const obligation = saveObligation(vaultStrategyAuth, lendingMarket);

  return [
    { pubkey: SAVE_PROGRAM_ID,             isSigner: false, isWritable: false },
    { pubkey: obligation,                  isSigner: false, isWritable: true  },
    { pubkey: lendingMarket,               isSigner: false, isWritable: true  },
    { pubkey: SYSVAR_CLOCK_PUBKEY,         isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,          isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
}

export interface SaveDepositParams {
  vault: PublicKey;
  strategy: PublicKey;
  counterPartyTa: PublicKey; // env: SAVE_COUNTERPARTY_TA (reserve liquidity supply)
  reserve: PublicKey;        // env: SAVE_RESERVE_ADDRESS
  lendingMarket: PublicKey;  // env: SAVE_LENDING_MARKET
  collateralMint: PublicKey; // env: SAVE_COLLATERAL_MINT
  pythOracle: PublicKey;     // env: SAVE_PYTH_ORACLE
  switchboardOracle: PublicKey; // env: SAVE_SWITCHBOARD_ORACLE
  vc: VoltrClient;
}

/**
 * RemainingAccounts for `createDepositStrategyIx` / `createWithdrawStrategyIx` (Save/Solend).
 * Does NOT require a network call.
 */
export function getSaveDepositRemainingAccounts(params: SaveDepositParams): AccountMeta[] {
  const { vault, strategy, counterPartyTa, reserve, lendingMarket, collateralMint, pythOracle, switchboardOracle, vc } = params;
  const { vaultStrategyAuth } = vc.findVaultStrategyAddresses(vault, strategy);
  const vaultCollateralAta = findAta(collateralMint, vaultStrategyAuth);
  const lendingMarketAuthority = saveLendingMarketAuthority(lendingMarket);

  return [
    { pubkey: counterPartyTa,          isSigner: false, isWritable: true  },
    { pubkey: SAVE_PROGRAM_ID,         isSigner: false, isWritable: false },
    { pubkey: vaultCollateralAta,      isSigner: false, isWritable: true  },
    { pubkey: reserve,                 isSigner: false, isWritable: true  },
    { pubkey: collateralMint,          isSigner: false, isWritable: true  },
    { pubkey: lendingMarket,           isSigner: false, isWritable: true  },
    { pubkey: lendingMarketAuthority,  isSigner: false, isWritable: false },
    { pubkey: pythOracle,              isSigner: false, isWritable: false },
    { pubkey: switchboardOracle,       isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
  ];
}

// ─── DRIFT ────────────────────────────────────────────────────────────────────

/**
 * Derive the strategy PDA for a Drift spot market.
 *
 * @param marketIndex  Drift spot market index (e.g. 15 for EURC/USDC).
 */
export function getDriftStrategyPDA(marketIndex: number): PublicKey {
  const index = new BN(marketIndex);
  const [counterPartyTa] = PublicKey.findProgramAddressSync(
    [Buffer.from('spot_market_vault'), index.toArrayLike(Buffer, 'le', 2)],
    DRIFT_PROGRAM_ID,
  );
  return PublicKey.findProgramAddressSync(
    [SEEDS.STRATEGY, counterPartyTa.toBuffer()],
    LENDING_ADAPTOR_PROGRAM_ID,
  )[0];
}

/** Derive the Drift spot market vault (counterPartyTa) */
function driftSpotMarketVault(marketIndex: number): PublicKey {
  const index = new BN(marketIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('spot_market_vault'), index.toArrayLike(Buffer, 'le', 2)],
    DRIFT_PROGRAM_ID,
  )[0];
}

function driftUserStats(vaultStrategyAuth: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_stats'), vaultStrategyAuth.toBuffer()],
    DRIFT_PROGRAM_ID,
  )[0];
}

function driftUser(vaultStrategyAuth: PublicKey, subAccountId = 0): PublicKey {
  const subId = new BN(subAccountId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user'), vaultStrategyAuth.toBuffer(), subId.toArrayLike(Buffer, 'le', 2)],
    DRIFT_PROGRAM_ID,
  )[0];
}

function driftSpotMarket(marketIndex: number): PublicKey {
  const index = new BN(marketIndex);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('spot_market'), index.toArrayLike(Buffer, 'le', 2)],
    DRIFT_PROGRAM_ID,
  )[0];
}

export interface DriftInitParams {
  vault: PublicKey;
  strategy: PublicKey;
  marketIndex: number; // env: DRIFT_SPOT_MARKET_INDEX
  vc: VoltrClient;
}

/**
 * RemainingAccounts for `createInitializeStrategyIx` (Drift).
 * Does NOT require a network call.
 */
export function getDriftInitRemainingAccounts(params: DriftInitParams): AccountMeta[] {
  const { vault, strategy, vc } = params;
  const { vaultStrategyAuth } = vc.findVaultStrategyAddresses(vault, strategy);
  const userStats = driftUserStats(vaultStrategyAuth);
  const user      = driftUser(vaultStrategyAuth);

  return [
    { pubkey: DRIFT_PROGRAM_ID,   isSigner: false, isWritable: false },
    { pubkey: userStats,          isSigner: false, isWritable: true  },
    { pubkey: DRIFT_STATE_PUBKEY, isSigner: false, isWritable: true  },
    { pubkey: user,               isSigner: false, isWritable: true  },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ];
}

export interface DriftDepositResult {
  remainingAccounts: AccountMeta[];
  /** additionalArgs to pass to createDepositStrategyIx / createWithdrawStrategyIx */
  additionalArgs: Buffer;
}

export interface DriftDepositParams {
  vault: PublicKey;
  strategy: PublicKey;
  marketIndex: number;  // env: DRIFT_SPOT_MARKET_INDEX
  oracle: PublicKey;    // env: DRIFT_ORACLE_ADDRESS
  vc: VoltrClient;
}

/**
 * RemainingAccounts + additionalArgs for `createDepositStrategyIx` (Drift).
 * Does NOT require a network call.
 */
export function getDriftDepositRemainingAccounts(params: DriftDepositParams): DriftDepositResult {
  const { vault, strategy, marketIndex, oracle, vc } = params;
  const { vaultStrategyAuth } = vc.findVaultStrategyAddresses(vault, strategy);
  const index          = new BN(marketIndex);
  const counterPartyTa = driftSpotMarketVault(marketIndex);
  const userStats      = driftUserStats(vaultStrategyAuth);
  const user           = driftUser(vaultStrategyAuth);
  const spotMarket     = driftSpotMarket(marketIndex);

  return {
    remainingAccounts: [
      { pubkey: counterPartyTa,     isSigner: false, isWritable: true  },
      { pubkey: DRIFT_PROGRAM_ID,   isSigner: false, isWritable: false },
      { pubkey: DRIFT_STATE_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: user,               isSigner: false, isWritable: true  },
      { pubkey: userStats,          isSigner: false, isWritable: true  },
      { pubkey: oracle,             isSigner: false, isWritable: false },
      { pubkey: spotMarket,         isSigner: false, isWritable: true  },
    ],
    additionalArgs: index.toArrayLike(Buffer, 'le', 2),
  };
}

// ─── KAMINO ───────────────────────────────────────────────────────────────────

/**
 * Kamino strategy address = the reserve address itself.
 * Unlike Save/Drift, Kamino does not derive a new PDA — the reserve IS the strategy.
 */
export function getKaminoStrategyAddress(reserveAddress: PublicKey): PublicKey {
  return reserveAddress;
}

function kaminoObligation(vaultStrategyAuth: PublicKey, lendingMarket: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new BN(0).toArrayLike(Buffer, 'le', 1),
      new BN(0).toArrayLike(Buffer, 'le', 1),
      vaultStrategyAuth.toBuffer(),
      lendingMarket.toBuffer(),
      SystemProgram.programId.toBuffer(),
      SystemProgram.programId.toBuffer(),
    ],
    KLEND_PROGRAM_ID,
  )[0];
}

function kaminoLendingMarketAuthority(lendingMarket: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('lma'), lendingMarket.toBuffer()],
    KLEND_PROGRAM_ID,
  )[0];
}

function kaminoUserMetadata(vaultStrategyAuth: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_meta'), vaultStrategyAuth.toBuffer()],
    KLEND_PROGRAM_ID,
  )[0];
}

function kaminoObligationFarm(farmCollateral: PublicKey, obligation: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user'), farmCollateral.toBuffer(), obligation.toBuffer()],
    FARMS_PROGRAM_ID,
  )[0];
}

export interface KaminoInitParams {
  vault: PublicKey;
  reserve: PublicKey;          // env: KAMINO_RESERVE_ADDRESS
  connection: Connection;
  vc: VoltrClient;
}

/**
 * RemainingAccounts for `createInitializeStrategyIx` (Kamino kLend).
 * Requires a network call to fetch reserve account.
 */
export async function getKaminoInitRemainingAccounts(
  params: KaminoInitParams,
): Promise<AccountMeta[]> {
  const { vault, reserve, connection, vc } = params;
  // strategy = reserve for Kamino
  const { vaultStrategyAuth } = vc.findVaultStrategyAddresses(vault, reserve);

  const reserveAccount = await getSingleReserve(reserve, connection, 400);
  const lendingMarket = new PublicKey(reserveAccount.state.lendingMarket.toString());
  const obligation    = kaminoObligation(vaultStrategyAuth, lendingMarket);
  const lendingMarketAuthority = kaminoLendingMarketAuthority(lendingMarket);
  const userMetadata  = kaminoUserMetadata(vaultStrategyAuth);

  const farmCollateral = new PublicKey(reserveAccount.state.farmCollateral.toString());
  const hasFarm        = !farmCollateral.equals(PublicKey.default);
  const reserveFarmState = hasFarm ? farmCollateral : new PublicKey(DEFAULT_KLEND_PROGRAM_ID);
  const obligationFarm   = hasFarm
    ? kaminoObligationFarm(farmCollateral, obligation)
    : new PublicKey(DEFAULT_KLEND_PROGRAM_ID);

  return [
    { pubkey: userMetadata,          isSigner: false, isWritable: true  },
    { pubkey: obligation,            isSigner: false, isWritable: true  },
    { pubkey: lendingMarketAuthority,isSigner: false, isWritable: false },
    { pubkey: reserve,               isSigner: false, isWritable: true  },
    { pubkey: reserveFarmState,      isSigner: false, isWritable: true  },
    { pubkey: obligationFarm,        isSigner: false, isWritable: true  },
    { pubkey: lendingMarket,         isSigner: false, isWritable: false },
    { pubkey: FARMS_PROGRAM_ID,      isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,    isSigner: false, isWritable: false },
    { pubkey: KLEND_PROGRAM_ID,      isSigner: false, isWritable: false },
  ];
}

export interface KaminoDepositParams {
  vault: PublicKey;
  reserve: PublicKey;    // env: KAMINO_RESERVE_ADDRESS
  connection: Connection;
  vc: VoltrClient;
}

/**
 * RemainingAccounts for `createDepositStrategyIx` / `createWithdrawStrategyIx` (Kamino kLend).
 * Requires a network call to fetch the reserve account.
 */
export async function getKaminoDepositRemainingAccounts(
  params: KaminoDepositParams,
): Promise<AccountMeta[]> {
  const { vault, reserve, connection, vc } = params;
  const { vaultStrategyAuth } = vc.findVaultStrategyAddresses(vault, reserve);

  const reserveAccount = await getSingleReserve(reserve, connection, 400);
  const lendingMarket = new PublicKey(reserveAccount.state.lendingMarket.toString());
  const obligation    = kaminoObligation(vaultStrategyAuth, lendingMarket);
  const lendingMarketAuthority = kaminoLendingMarketAuthority(lendingMarket);
  const userMetadata  = kaminoUserMetadata(vaultStrategyAuth);

  const reserveLiquiditySupply              = new PublicKey(reserveAccount.state.liquidity.supplyVault.toString());
  const reserveCollateralMint               = new PublicKey(reserveAccount.state.collateral.mintPubkey.toString());
  const reserveDestinationDepositCollateral = new PublicKey(reserveAccount.state.collateral.supplyVault.toString());
  const scope = new PublicKey(
    reserveAccount.state.config.tokenInfo.scopeConfiguration.priceFeed.toString(),
  );

  const farmCollateral = new PublicKey(reserveAccount.state.farmCollateral.toString());
  const hasFarm        = !farmCollateral.equals(PublicKey.default);
  const reserveFarmState = hasFarm ? farmCollateral : new PublicKey(DEFAULT_KLEND_PROGRAM_ID);
  const obligationFarm   = hasFarm
    ? kaminoObligationFarm(farmCollateral, obligation)
    : new PublicKey(DEFAULT_KLEND_PROGRAM_ID);

  return [
    { pubkey: obligation,                            isSigner: false, isWritable: true  },
    { pubkey: lendingMarket,                         isSigner: false, isWritable: false },
    { pubkey: lendingMarketAuthority,                isSigner: false, isWritable: false },
    { pubkey: reserve,                               isSigner: false, isWritable: true  },
    { pubkey: reserveLiquiditySupply,                isSigner: false, isWritable: true  },
    { pubkey: reserveCollateralMint,                 isSigner: false, isWritable: true  },
    { pubkey: reserveDestinationDepositCollateral,   isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID,                      isSigner: false, isWritable: false },
    { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,            isSigner: false, isWritable: false },
    { pubkey: obligationFarm,                        isSigner: false, isWritable: true  },
    { pubkey: reserveFarmState,                      isSigner: false, isWritable: true  },
    { pubkey: userMetadata,                          isSigner: false, isWritable: true  },
    { pubkey: scope,                                 isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,                    isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId,               isSigner: false, isWritable: false },
    { pubkey: FARMS_PROGRAM_ID,                      isSigner: false, isWritable: false },
    { pubkey: KLEND_PROGRAM_ID,                      isSigner: false, isWritable: false },
  ];
}

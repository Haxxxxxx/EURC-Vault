/**
 * Smoke tests for VoltrClient SDK integration.
 *
 * Validates that:
 * 1. VoltrClient can be instantiated with a Connection
 * 2. All expected SDK methods are present (API contract)
 * 3. PDA derivation helpers produce deterministic results
 * 4. remaining-accounts helpers produce correctly-shaped AccountMeta arrays
 *
 * No live RPC calls are made — connection is mocked so tests are fast + hermetic.
 */
import { describe, it, expect, vi } from 'vitest';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { VoltrClient, LENDING_ADAPTOR_PROGRAM_ID, SEEDS } from '@voltr/vault-sdk';

// ─── Mock the web3 Connection so no network I/O occurs ───────────────────────

vi.mock('@solana/web3.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solana/web3.js')>();
  // Keep the full module but stub out network methods on Connection
  const MockConnection = vi.fn().mockImplementation(() => ({
    getAccountInfo:           vi.fn().mockResolvedValue(null),
    getTokenAccountBalance:   vi.fn().mockResolvedValue({ value: { uiAmountString: '0', amount: '0', decimals: 6 } }),
    getTokenSupply:           vi.fn().mockResolvedValue({ value: { uiAmountString: '0', amount: '0', decimals: 6 } }),
    getRecentBlockhash:       vi.fn().mockResolvedValue({ blockhash: 'mock-blockhash', feeCalculator: { lamportsPerSignature: 5000 } }),
    sendTransaction:          vi.fn().mockResolvedValue('mock-txsig'),
    confirmTransaction:       vi.fn().mockResolvedValue({ value: { err: null } }),
    getParsedTransaction:     vi.fn().mockResolvedValue(null),
    getLatestBlockhash:       vi.fn().mockResolvedValue({ blockhash: 'mock-blockhash', lastValidBlockHeight: 100 }),
    rpcEndpoint:              'https://api.mainnet-beta.solana.com',
  }));
  return { ...actual, Connection: MockConnection };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Known Ranger Earn vault for deterministic PDA checks (EURC stability vault) */
const KNOWN_VAULT = new PublicKey('7tqPPnaeMKFvivyJmHaRZSuyXbBhK4GNfCxkMv5a8c9W');
const EURC_MINT   = new PublicKey('HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VoltrClient — SDK smoke tests', () => {

  describe('instantiation', () => {
    it('constructs with a Connection instance', () => {
      const conn   = new Connection('https://api.mainnet-beta.solana.com');
      const client = new VoltrClient(conn);
      expect(client).toBeDefined();
    });

    it('exposes all expected methods', () => {
      const conn   = new Connection('https://api.mainnet-beta.solana.com');
      const client = new VoltrClient(conn);

      // Vault lifecycle
      expect(typeof client.createInitializeVaultIx).toBe('function');
      expect(typeof client.createAddAdaptorIx).toBe('function');
      expect(typeof client.createInitializeStrategyIx).toBe('function');

      // Strategy operations
      expect(typeof client.createDepositStrategyIx).toBe('function');
      expect(typeof client.createWithdrawStrategyIx).toBe('function');

      // User vault operations
      expect(typeof client.createDepositVaultIx).toBe('function');
      expect(typeof client.createWithdrawVaultIx).toBe('function');

      // Reads
      expect(typeof client.fetchVaultAccount).toBe('function');
      expect(typeof client.getPositionAndTotalValuesForVault).toBe('function');
      expect(typeof client.fetchAllStrategyInitReceiptAccountsOfVault).toBe('function');
      expect(typeof client.fetchAllAdaptorAddReceiptAccountsOfVault).toBe('function');

      // Calculators
      expect(typeof client.calculateLpTokensForDeposit).toBe('function');
      expect(typeof client.calculateAssetsForWithdraw).toBe('function');

      // PDA finders
      expect(typeof client.findVaultAddresses).toBe('function');
      expect(typeof client.findVaultStrategyAddresses).toBe('function');
    });
  });

  describe('PDA derivation — findVaultAddresses', () => {
    it('returns deterministic vault LP mint address', () => {
      const conn   = new Connection('https://api.mainnet-beta.solana.com');
      const client = new VoltrClient(conn);
      const addrs  = client.findVaultAddresses(KNOWN_VAULT);

      expect(addrs).toHaveProperty('vaultLpMint');
      expect(addrs.vaultLpMint).toBeInstanceOf(PublicKey);

      // Calling twice must return the same value (deterministic PDA)
      const addrs2 = client.findVaultAddresses(KNOWN_VAULT);
      expect(addrs.vaultLpMint.toBase58()).toBe(addrs2.vaultLpMint.toBase58());
    });

    it('returns distinct addresses for distinct vaults', () => {
      const conn    = new Connection('https://api.mainnet-beta.solana.com');
      const client  = new VoltrClient(conn);
      const vault2  = new PublicKey('3uTzTX5GBSfbW7eM9R62toBfd6MrsyUAGnTzuvVzqCy6');
      const addrs1  = client.findVaultAddresses(KNOWN_VAULT);
      const addrs2  = client.findVaultAddresses(vault2);

      expect(addrs1.vaultLpMint.toBase58()).not.toBe(addrs2.vaultLpMint.toBase58());
    });
  });

  describe('PDA derivation — findVaultStrategyAddresses', () => {
    it('returns vaultStrategyAuth for a strategy', () => {
      const conn     = new Connection('https://api.mainnet-beta.solana.com');
      const client   = new VoltrClient(conn);
      const strategy = PublicKey.findProgramAddressSync(
        [SEEDS.STRATEGY, EURC_MINT.toBuffer()],
        LENDING_ADAPTOR_PROGRAM_ID,
      )[0];

      const addrs = client.findVaultStrategyAddresses(KNOWN_VAULT, strategy);
      expect(addrs).toHaveProperty('vaultStrategyAuth');
      expect(addrs.vaultStrategyAuth).toBeInstanceOf(PublicKey);

      // Must be off-curve (PDA)
      expect(PublicKey.isOnCurve(addrs.vaultStrategyAuth.toBytes())).toBe(false);
    });

    it('returns deterministic vaultStrategyAuth', () => {
      const conn     = new Connection('https://api.mainnet-beta.solana.com');
      const client   = new VoltrClient(conn);
      const strategy = new PublicKey('4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY');

      const a1 = client.findVaultStrategyAddresses(KNOWN_VAULT, strategy);
      const a2 = client.findVaultStrategyAddresses(KNOWN_VAULT, strategy);
      expect(a1.vaultStrategyAuth.toBase58()).toBe(a2.vaultStrategyAuth.toBase58());
    });
  });

  describe('SDK constants', () => {
    it('LENDING_ADAPTOR_PROGRAM_ID is the expected Ranger address', () => {
      expect(LENDING_ADAPTOR_PROGRAM_ID.toBase58()).toBe(
        'aVoLTRCRt3NnnchvLYH6rMYehJHwM5m45RmLBZq7PGz',
      );
    });

    it('SEEDS.STRATEGY is a non-empty Buffer', () => {
      expect(Buffer.isBuffer(SEEDS.STRATEGY)).toBe(true);
      expect(SEEDS.STRATEGY.length).toBeGreaterThan(0);
    });

    it('SEEDS.VAULT_LP_MINT is a non-empty Buffer', () => {
      expect(Buffer.isBuffer(SEEDS.VAULT_LP_MINT)).toBe(true);
      expect(SEEDS.VAULT_LP_MINT.length).toBeGreaterThan(0);
    });
  });
});

describe('remaining-accounts helpers — shape validation', () => {
  // Import helpers after mocks are set up
  // We test the account shapes without needing live network calls

  it('getSaveStrategyPDA returns an off-curve PublicKey', async () => {
    const { getSaveStrategyPDA } = await import('../bot/utils/remaining-accounts.js');
    const counterPartyTa = new PublicKey('8SheGtsopRUDzdiD6v6BR9a6bqZ9QwywYQY99Fp5meNf');
    const pda = getSaveStrategyPDA(counterPartyTa);
    expect(pda).toBeInstanceOf(PublicKey);
    expect(PublicKey.isOnCurve(pda.toBytes())).toBe(false);
  });

  it('getDriftStrategyPDA returns an off-curve PublicKey', async () => {
    const { getDriftStrategyPDA } = await import('../bot/utils/remaining-accounts.js');
    const pda = getDriftStrategyPDA(15); // market index 15 = EURC
    expect(pda).toBeInstanceOf(PublicKey);
    expect(PublicKey.isOnCurve(pda.toBytes())).toBe(false);
  });

  it('getDriftStrategyPDA produces different PDAs for different market indices', async () => {
    const { getDriftStrategyPDA } = await import('../bot/utils/remaining-accounts.js');
    const pda0  = getDriftStrategyPDA(0);   // USDC
    const pda5  = getDriftStrategyPDA(5);   // USDT
    const pda15 = getDriftStrategyPDA(15);  // EURC
    expect(pda0.toBase58()).not.toBe(pda5.toBase58());
    expect(pda5.toBase58()).not.toBe(pda15.toBase58());
  });

  it('getKaminoStrategyAddress returns the reserve address itself', async () => {
    const { getKaminoStrategyAddress } = await import('../bot/utils/remaining-accounts.js');
    const reserve  = new PublicKey('D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59');
    const strategy = getKaminoStrategyAddress(reserve);
    expect(strategy.toBase58()).toBe(reserve.toBase58());
  });

  it('getSaveInitRemainingAccounts returns 7 accounts with correct signer flags', async () => {
    const { getSaveInitRemainingAccounts } = await import('../bot/utils/remaining-accounts.js');
    const conn   = new Connection('https://api.mainnet-beta.solana.com');
    const client = new VoltrClient(conn);

    const counterPartyTa = new PublicKey('8SheGtsopRUDzdiD6v6BR9a6bqZ9QwywYQY99Fp5meNf');
    const { getSaveStrategyPDA } = await import('../bot/utils/remaining-accounts.js');
    const strategy = getSaveStrategyPDA(counterPartyTa);

    const accounts = getSaveInitRemainingAccounts({
      vault:         KNOWN_VAULT,
      strategy,
      lendingMarket: new PublicKey('4UpD2fh7xH3VP9QQaXtsS1YY3bxzWhtfpks7FatyKvdY'),
      collateralMint: EURC_MINT,
      vc: client,
    });

    expect(accounts).toHaveLength(7);
    accounts.forEach((acct) => {
      expect(acct).toHaveProperty('pubkey');
      expect(acct).toHaveProperty('isSigner');
      expect(acct).toHaveProperty('isWritable');
      expect(acct.pubkey).toBeInstanceOf(PublicKey);
      expect(typeof acct.isSigner).toBe('boolean');
      expect(typeof acct.isWritable).toBe('boolean');
      // No account in init should be a signer (from our list)
      expect(acct.isSigner).toBe(false);
    });
  });

  it('getDriftInitRemainingAccounts returns 5 accounts', async () => {
    const { getDriftStrategyPDA, getDriftInitRemainingAccounts } = await import('../bot/utils/remaining-accounts.js');
    const conn   = new Connection('https://api.mainnet-beta.solana.com');
    const client = new VoltrClient(conn);
    const strategy = getDriftStrategyPDA(15);

    const accounts = getDriftInitRemainingAccounts({
      vault: KNOWN_VAULT,
      strategy,
      marketIndex: 15,
      vc: client,
    });

    expect(accounts).toHaveLength(5);
    accounts.forEach((acct) => {
      expect(acct.pubkey).toBeInstanceOf(PublicKey);
      expect(acct.isSigner).toBe(false);
    });
  });

  it('getDriftDepositRemainingAccounts returns 7 accounts + additionalArgs buffer', async () => {
    const { getDriftStrategyPDA, getDriftDepositRemainingAccounts } = await import('../bot/utils/remaining-accounts.js');
    const conn   = new Connection('https://api.mainnet-beta.solana.com');
    const client = new VoltrClient(conn);
    const strategy = getDriftStrategyPDA(15);
    const oracle   = new PublicKey('9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV'); // EURC oracle

    const result = getDriftDepositRemainingAccounts({
      vault: KNOWN_VAULT,
      strategy,
      marketIndex: 15,
      oracle,
      vc: client,
    });

    expect(result.remainingAccounts).toHaveLength(7);
    expect(Buffer.isBuffer(result.additionalArgs)).toBe(true);
    // additionalArgs should be marketIndex (15) as 2-byte LE
    expect(result.additionalArgs.length).toBe(2);
    expect(result.additionalArgs.readUInt16LE(0)).toBe(15);
  });

  it('additionalArgs encodes market index correctly (LE 2 bytes)', async () => {
    const { getDriftStrategyPDA, getDriftDepositRemainingAccounts } = await import('../bot/utils/remaining-accounts.js');
    const conn     = new Connection('https://api.mainnet-beta.solana.com');
    const client   = new VoltrClient(conn);
    const oracle   = new PublicKey(SystemProgram.programId);

    for (const idx of [0, 1, 5, 15, 22, 28] as const) {
      const strategy = getDriftStrategyPDA(idx);
      const { additionalArgs } = getDriftDepositRemainingAccounts({
        vault: KNOWN_VAULT, strategy, marketIndex: idx, oracle, vc: client,
      });
      expect(additionalArgs.readUInt16LE(0)).toBe(idx);
    }
  });
});

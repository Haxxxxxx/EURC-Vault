import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { EurcVault } from "../target/types/eurc_vault";
import {
  TestContext,
  ONE_EURC,
  PRECISION,
  DEFAULT_EPOCH_DURATION,
  DEFAULT_COOLDOWN,
  DEFAULT_CAPACITY,
  EURC_DECIMALS,
  setupTestVault,
  setupUserWithTokens,
  deposit,
  fundRewards,
  findVaultConfigPda,
  findVaultAuthorityPda,
  findUserStakePda,
  findEpochSnapshotPda,
  airdrop,
  createTestMint,
  checkVaultInvariant,
  sleep,
} from "./helpers";

describe("EURC Vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.EurcVault as Program<EurcVault>;

  let vaultCounter = 0;
  const nextVaultId = () => ++vaultCounter;

  // ────────────────────────────────────────────────────────────────────
  // Initialize Vault
  // ────────────────────────────────────────────────────────────────────
  describe("Initialize Vault", () => {
    it("creates a vault with valid config and pbEURC mint", async () => {
      const id = nextVaultId();
      const ctx = await setupTestVault(program, provider, id);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.vaultId.toNumber()).to.equal(id);
      expect(vault.authority.toBase58()).to.equal(
        ctx.authority.publicKey.toBase58()
      );
      expect(vault.eurcMint.toBase58()).to.equal(ctx.eurcMint.toBase58());
      expect(vault.pbEurcMint.toBase58()).to.equal(ctx.pbEurcMint.toBase58());
      expect(vault.maxCapacity.toNumber()).to.equal(DEFAULT_CAPACITY);
      expect(vault.epochDuration.toNumber()).to.equal(DEFAULT_EPOCH_DURATION);
      expect(vault.withdrawalCooldown.toNumber()).to.equal(DEFAULT_COOLDOWN);
      expect(vault.paused).to.be.false;
      expect(vault.currentEpoch.toNumber()).to.equal(1);
      expect(vault.totalEurcInVault.toNumber()).to.equal(0);
      expect(vault.totalPbEurcSupply.toNumber()).to.equal(0);
      expect(vault.totalRewardsFunded.toNumber()).to.equal(0);
      expect(vault.exchangeRate.toString()).to.equal(PRECISION.toString());
      expect(vault.stakerCount.toNumber()).to.equal(0);
    });

    it("creates vault with zero cooldown (instant withdrawals)", async () => {
      const id = nextVaultId();
      const ctx = await setupTestVault(
        program,
        provider,
        id,
        DEFAULT_EPOCH_DURATION,
        0 // zero cooldown
      );

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.withdrawalCooldown.toNumber()).to.equal(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Deposit
  // ────────────────────────────────────────────────────────────────────
  describe("Deposit", () => {
    let ctx: TestContext;

    beforeEach(async () => {
      ctx = await setupTestVault(program, provider, nextVaultId());
    });

    it("first deposit mints pbEURC shares at 1:1 rate", async () => {
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      const depositAmount = 100 * ONE_EURC;

      await deposit(
        ctx,
        user,
        userTokenAccount,
        userPbTokenAccount,
        depositAmount
      );

      // pbEURC balance = deposit amount (1:1 rate)
      const pbBalance = await provider.connection.getTokenAccountBalance(
        userPbTokenAccount
      );
      expect(Number(pbBalance.value.amount)).to.equal(depositAmount);

      // user_stake initialized
      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );
      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.user.toBase58()).to.equal(user.publicKey.toBase58());

      // Vault state
      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalEurcInVault.toNumber()).to.equal(depositAmount);
      expect(vault.totalPbEurcSupply.toNumber()).to.equal(depositAmount);
      expect(vault.stakerCount.toNumber()).to.equal(1);
      expect(vault.exchangeRate.toString()).to.equal(PRECISION.toString());

      await checkVaultInvariant(ctx);
    });

    it("second deposit increments totals", async () => {
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 50 * ONE_EURC);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 30 * ONE_EURC);

      const pbBalance = await provider.connection.getTokenAccountBalance(
        userPbTokenAccount
      );
      expect(Number(pbBalance.value.amount)).to.equal(80 * ONE_EURC);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalEurcInVault.toNumber()).to.equal(80 * ONE_EURC);
      expect(vault.totalPbEurcSupply.toNumber()).to.equal(80 * ONE_EURC);
      // staker_count should still be 1 (same user)
      expect(vault.stakerCount.toNumber()).to.equal(1);
    });

    it("multiple users increment staker_count", async () => {
      const user1 = await setupUserWithTokens(ctx);
      const user2 = await setupUserWithTokens(ctx);

      await deposit(
        ctx,
        user1.user,
        user1.userTokenAccount,
        user1.userPbTokenAccount,
        50 * ONE_EURC
      );
      await deposit(
        ctx,
        user2.user,
        user2.userTokenAccount,
        user2.userPbTokenAccount,
        75 * ONE_EURC
      );

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.stakerCount.toNumber()).to.equal(2);
      expect(vault.totalEurcInVault.toNumber()).to.equal(125 * ONE_EURC);
      expect(vault.totalPbEurcSupply.toNumber()).to.equal(125 * ONE_EURC);
    });

    it("rejects zero deposit", async () => {
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      try {
        await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 0);
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain("ZeroDeposit");
      }
    });

    it("rejects deposit below minimum", async () => {
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      try {
        await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100); // 0.0001 EURC < 1 EURC min
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain(
          "DepositTooSmall"
        );
      }
    });

    it("rejects deposit exceeding capacity", async () => {
      // Create vault with tiny capacity
      const tinyCtx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        DEFAULT_COOLDOWN,
        10 * ONE_EURC // 10 EURC capacity
      );
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(tinyCtx);

      try {
        await deposit(
          tinyCtx,
          user,
          userTokenAccount,
          userPbTokenAccount,
          11 * ONE_EURC
        );
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain(
          "VaultCapacityExceeded"
        );
      }
    });

    it("rejects deposit when paused", async () => {
      // Pause the vault
      await program.methods
        .togglePause()
        .accounts({
          authority: ctx.authority.publicKey,
          vaultConfig: ctx.vaultConfig,
        })
        .signers([ctx.authority])
        .rpc();

      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      try {
        await deposit(
          ctx,
          user,
          userTokenAccount,
          userPbTokenAccount,
          10 * ONE_EURC
        );
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain("VaultPaused");
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Withdrawal
  // ────────────────────────────────────────────────────────────────────
  describe("Withdrawal", () => {
    it("initiate withdrawal burns shares and sets pending state", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );

      await program.methods
        .initiateWithdrawal(new anchor.BN(50 * ONE_EURC))
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          pbEurcMint: ctx.pbEurcMint,
          userPbTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.pendingWithdrawalEurc.toNumber()).to.equal(50 * ONE_EURC);
      expect(stake.pendingWithdrawalShares.toNumber()).to.equal(50 * ONE_EURC); // 1:1 rate
      expect(stake.withdrawalAvailableAt.toNumber()).to.be.greaterThan(0);

      // pbEURC balance reduced
      const pbBalance = await provider.connection.getTokenAccountBalance(
        userPbTokenAccount
      );
      expect(Number(pbBalance.value.amount)).to.equal(50 * ONE_EURC);

      // Vault supply reduced
      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalPbEurcSupply.toNumber()).to.equal(50 * ONE_EURC);

      await checkVaultInvariant(ctx);
    });

    it("rejects withdrawal exceeding shares balance", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );

      try {
        await program.methods
          .initiateWithdrawal(new anchor.BN(200 * ONE_EURC))
          .accounts({
            user: user.publicKey,
            vaultConfig: ctx.vaultConfig,
            userStake: userStakePda,
            pbEurcMint: ctx.pbEurcMint,
            userPbTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain(
          "InsufficientShares"
        );
      }
    });

    it("rejects duplicate pending withdrawal", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );

      await program.methods
        .initiateWithdrawal(new anchor.BN(30 * ONE_EURC))
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          pbEurcMint: ctx.pbEurcMint,
          userPbTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      try {
        await program.methods
          .initiateWithdrawal(new anchor.BN(20 * ONE_EURC))
          .accounts({
            user: user.publicKey,
            vaultConfig: ctx.vaultConfig,
            userStake: userStakePda,
            pbEurcMint: ctx.pbEurcMint,
            userPbTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([user])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain(
          "WithdrawalAlreadyPending"
        );
      }
    });

    it("cancel withdrawal re-mints shares at current rate", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );

      await program.methods
        .initiateWithdrawal(new anchor.BN(50 * ONE_EURC))
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          pbEurcMint: ctx.pbEurcMint,
          userPbTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      await program.methods
        .cancelWithdrawal()
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          pbEurcMint: ctx.pbEurcMint,
          pbMintAuthority: ctx.pbMintAuthority,
          userPbTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.pendingWithdrawalEurc.toNumber()).to.equal(0);
      expect(stake.pendingWithdrawalShares.toNumber()).to.equal(0);
      expect(stake.withdrawalAvailableAt.toNumber()).to.equal(0);

      // At 1:1 rate, should get back same number of shares
      const pbBalance = await provider.connection.getTokenAccountBalance(
        userPbTokenAccount
      );
      expect(Number(pbBalance.value.amount)).to.equal(100 * ONE_EURC);

      await checkVaultInvariant(ctx);
    });

    it("instant withdrawal with zero cooldown", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        0 // zero cooldown
      );
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );

      // Initiate
      await program.methods
        .initiateWithdrawal(new anchor.BN(50 * ONE_EURC))
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          pbEurcMint: ctx.pbEurcMint,
          userPbTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      // Complete immediately (zero cooldown)
      await program.methods
        .completeWithdrawal()
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          vaultAuthority: ctx.vaultAuthority,
          vaultTokenAccount: ctx.vaultTokenAccount,
          userTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.pendingWithdrawalEurc.toNumber()).to.equal(0);

      // Remaining pbEURC balance
      const pbBalance = await provider.connection.getTokenAccountBalance(
        userPbTokenAccount
      );
      expect(Number(pbBalance.value.amount)).to.equal(50 * ONE_EURC);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalEurcInVault.toNumber()).to.equal(50 * ONE_EURC);
      expect(vault.totalPbEurcSupply.toNumber()).to.equal(50 * ONE_EURC);

      await checkVaultInvariant(ctx);
    });

    it("full withdrawal returns all EURC", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        0
      );
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );

      // Withdraw everything
      await program.methods
        .initiateWithdrawal(new anchor.BN(100 * ONE_EURC))
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          pbEurcMint: ctx.pbEurcMint,
          userPbTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      await program.methods
        .completeWithdrawal()
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          vaultAuthority: ctx.vaultAuthority,
          vaultTokenAccount: ctx.vaultTokenAccount,
          userTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalEurcInVault.toNumber()).to.equal(0);
      expect(vault.totalPbEurcSupply.toNumber()).to.equal(0);

      // User should have all EURC back (1000 EURC initial funding)
      const eurcBalance = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );
      expect(Number(eurcBalance.value.amount)).to.equal(1000 * ONE_EURC);

      await checkVaultInvariant(ctx);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Exchange Rate & Rewards
  // ────────────────────────────────────────────────────────────────────
  describe("Exchange Rate & Rewards", () => {
    it("fund_rewards increases exchange_rate", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      await fundRewards(ctx, 10 * ONE_EURC);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalRewardsFunded.toNumber()).to.equal(10 * ONE_EURC);
      expect(vault.totalEurcInVault.toNumber()).to.equal(110 * ONE_EURC);
      expect(vault.totalPbEurcSupply.toNumber()).to.equal(100 * ONE_EURC);
      // exchange_rate = 110_000_000 * 10^12 / 100_000_000 = 1_100_000_000_000
      expect(vault.exchangeRate.toString()).to.equal("1100000000000");

      await checkVaultInvariant(ctx);
    });

    it("deposit at higher rate gets fewer shares", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        0
      );

      // User A deposits 100 EURC at 1:1 rate
      const userA = await setupUserWithTokens(ctx);
      await deposit(
        ctx,
        userA.user,
        userA.userTokenAccount,
        userA.userPbTokenAccount,
        100 * ONE_EURC
      );

      // Fund 10 EURC rewards → rate = 1.1x
      await fundRewards(ctx, 10 * ONE_EURC);

      // User B deposits 100 EURC at 1.1x rate — should get fewer shares
      const userB = await setupUserWithTokens(ctx);
      await deposit(
        ctx,
        userB.user,
        userB.userTokenAccount,
        userB.userPbTokenAccount,
        100 * ONE_EURC
      );

      const balA = await provider.connection.getTokenAccountBalance(
        userA.userPbTokenAccount
      );
      const balB = await provider.connection.getTokenAccountBalance(
        userB.userPbTokenAccount
      );

      // A has 100M shares (deposited at 1:1)
      expect(Number(balA.value.amount)).to.equal(100 * ONE_EURC);
      // B gets fewer shares: 100_000_000 * 10^12 / 1_100_000_000_000 ≈ 90_909_090
      expect(Number(balB.value.amount)).to.be.lessThan(100 * ONE_EURC);
      expect(Number(balB.value.amount)).to.be.closeTo(90_909_090, 10);

      await checkVaultInvariant(ctx);
    });

    it("pro-rata distribution between two stakers", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        0
      );

      // User A deposits 75 EURC, User B deposits 25 EURC (75/25 split)
      const userA = await setupUserWithTokens(ctx);
      const userB = await setupUserWithTokens(ctx);

      await deposit(
        ctx,
        userA.user,
        userA.userTokenAccount,
        userA.userPbTokenAccount,
        75 * ONE_EURC
      );
      await deposit(
        ctx,
        userB.user,
        userB.userTokenAccount,
        userB.userPbTokenAccount,
        25 * ONE_EURC
      );

      // At 1:1 rate: A = 75M shares, B = 25M shares
      const balA = await provider.connection.getTokenAccountBalance(
        userA.userPbTokenAccount
      );
      const balB = await provider.connection.getTokenAccountBalance(
        userB.userPbTokenAccount
      );
      expect(Number(balA.value.amount)).to.equal(75 * ONE_EURC);
      expect(Number(balB.value.amount)).to.equal(25 * ONE_EURC);

      // Fund 100 EURC in rewards — rate doubles to 2x
      await fundRewards(ctx, 100 * ONE_EURC);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      // rate = (75 + 25 + 100) * 10^12 / 100 = 2 * 10^12
      expect(vault.exchangeRate.toString()).to.equal("2000000000000");

      // A's 75M shares at 2x rate = 150 EURC value (75 deposit + 75 reward share)
      // Verify by withdrawing
      const [stakeA] = findUserStakePda(
        ctx.vaultConfig,
        userA.user.publicKey,
        program.programId
      );

      const eurcBalABefore = await provider.connection.getTokenAccountBalance(
        userA.userTokenAccount
      );

      await program.methods
        .initiateWithdrawal(new anchor.BN(150 * ONE_EURC))
        .accounts({
          user: userA.user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: stakeA,
          pbEurcMint: ctx.pbEurcMint,
          userPbTokenAccount: userA.userPbTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userA.user])
        .rpc();

      await program.methods
        .completeWithdrawal()
        .accounts({
          user: userA.user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: stakeA,
          vaultAuthority: ctx.vaultAuthority,
          vaultTokenAccount: ctx.vaultTokenAccount,
          userTokenAccount: userA.userTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userA.user])
        .rpc();

      const eurcBalAAfter = await provider.connection.getTokenAccountBalance(
        userA.userTokenAccount
      );
      const receivedA =
        Number(eurcBalAAfter.value.amount) -
        Number(eurcBalABefore.value.amount);
      // A should get 150 EURC (75 deposit + 75 from rewards)
      expect(receivedA).to.equal(150 * ONE_EURC);
    });

    it("rejects fund_rewards when no stakers", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());

      try {
        await fundRewards(ctx, 10 * ONE_EURC);
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain(
          "NoActiveStakers"
        );
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Admin
  // ────────────────────────────────────────────────────────────────────
  describe("Admin", () => {
    it("update_vault_config modifies parameters", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());

      await program.methods
        .updateVaultConfig(
          new anchor.BN(5_000_000 * ONE_EURC),
          new anchor.BN(3 * 24 * 60 * 60), // 3 days
          new anchor.BN(0) // no cooldown
        )
        .accounts({
          authority: ctx.authority.publicKey,
          vaultConfig: ctx.vaultConfig,
        })
        .signers([ctx.authority])
        .rpc();

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.maxCapacity.toNumber()).to.equal(5_000_000 * ONE_EURC);
      expect(vault.epochDuration.toNumber()).to.equal(3 * 24 * 60 * 60);
      expect(vault.withdrawalCooldown.toNumber()).to.equal(0);
    });

    it("toggle_pause blocks deposits but allows withdrawals", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        0
      );
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);

      // Deposit before pausing
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      // Pause
      await program.methods
        .togglePause()
        .accounts({
          authority: ctx.authority.publicKey,
          vaultConfig: ctx.vaultConfig,
        })
        .signers([ctx.authority])
        .rpc();

      let vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.paused).to.be.true;

      // Deposit should fail
      try {
        await deposit(
          ctx,
          user,
          userTokenAccount,
          userPbTokenAccount,
          10 * ONE_EURC
        );
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain("VaultPaused");
      }

      // Withdrawal should still work (initiate)
      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );

      await program.methods
        .initiateWithdrawal(new anchor.BN(50 * ONE_EURC))
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          pbEurcMint: ctx.pbEurcMint,
          userPbTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      // Complete withdrawal
      await program.methods
        .completeWithdrawal()
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          vaultAuthority: ctx.vaultAuthority,
          vaultTokenAccount: ctx.vaultTokenAccount,
          userTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      // Remaining pbEURC balance
      const pbBalance = await provider.connection.getTokenAccountBalance(
        userPbTokenAccount
      );
      expect(Number(pbBalance.value.amount)).to.equal(50 * ONE_EURC);
    });

    it("unauthorized user cannot call admin functions", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const rando = Keypair.generate();
      await airdrop(provider, rando.publicKey);

      try {
        await program.methods
          .togglePause()
          .accounts({
            authority: rando.publicKey,
            vaultConfig: ctx.vaultConfig,
          })
          .signers([rando])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain(
          "Unauthorized"
        );
      }
    });

    it("2-step authority transfer works", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const newAuth = Keypair.generate();
      await airdrop(provider, newAuth.publicKey);

      // Step 1: Current authority initiates
      await program.methods
        .initiateAuthorityTransfer(newAuth.publicKey)
        .accounts({
          authority: ctx.authority.publicKey,
          vaultConfig: ctx.vaultConfig,
        })
        .signers([ctx.authority])
        .rpc();

      let vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.pendingAuthority.toBase58()).to.equal(
        newAuth.publicKey.toBase58()
      );

      // Step 2: New authority accepts
      await program.methods
        .acceptAuthorityTransfer()
        .accounts({
          newAuthority: newAuth.publicKey,
          vaultConfig: ctx.vaultConfig,
        })
        .signers([newAuth])
        .rpc();

      vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.authority.toBase58()).to.equal(
        newAuth.publicKey.toBase58()
      );
      expect(vault.pendingAuthority.toBase58()).to.equal(
        PublicKey.default.toBase58()
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Epoch
  // ────────────────────────────────────────────────────────────────────
  describe("Epoch", () => {
    it("advance_epoch creates snapshot and increments epoch", async () => {
      // Use very short epoch for testing (1 second)
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        1, // 1 second epoch
        0
      );

      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      // Wait for epoch to end
      await sleep(2000);

      const [snapshotPda] = findEpochSnapshotPda(
        ctx.vaultConfig,
        1,
        program.programId
      );

      await program.methods
        .advanceEpoch()
        .accounts({
          authority: ctx.authority.publicKey,
          vaultConfig: ctx.vaultConfig,
          epochSnapshot: snapshotPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([ctx.authority])
        .rpc();

      const snapshot = await program.account.epochSnapshot.fetch(snapshotPda);
      expect(snapshot.epochNumber.toNumber()).to.equal(1);
      expect(snapshot.totalEurcInVault.toNumber()).to.equal(100 * ONE_EURC);
      expect(snapshot.totalPbEurcSupply.toNumber()).to.equal(100 * ONE_EURC);
      expect(snapshot.exchangeRate.toString()).to.equal(PRECISION.toString());

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.currentEpoch.toNumber()).to.equal(2);
    });

    it("rejects advance before epoch ends", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION, // 48 hours
        0
      );

      const [snapshotPda] = findEpochSnapshotPda(
        ctx.vaultConfig,
        1,
        program.programId
      );

      try {
        await program.methods
          .advanceEpoch()
          .accounts({
            authority: ctx.authority.publicKey,
            vaultConfig: ctx.vaultConfig,
            epochSnapshot: snapshotPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([ctx.authority])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain(
          "EpochNotEnded"
        );
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Emergency Withdraw
  // ────────────────────────────────────────────────────────────────────
  describe("Emergency Withdraw", () => {
    it("works even when vault is paused", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        DEFAULT_COOLDOWN
      );
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      // Pause
      await program.methods
        .togglePause()
        .accounts({
          authority: ctx.authority.publicKey,
          vaultConfig: ctx.vaultConfig,
        })
        .signers([ctx.authority])
        .rpc();

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );

      const balBefore = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );

      await program.methods
        .emergencyWithdraw()
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          vaultAuthority: ctx.vaultAuthority,
          vaultTokenAccount: ctx.vaultTokenAccount,
          userTokenAccount,
          pbEurcMint: ctx.pbEurcMint,
          userPbTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const balAfter = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );
      const recovered =
        Number(balAfter.value.amount) - Number(balBefore.value.amount);
      expect(recovered).to.equal(100 * ONE_EURC);

      // pbEURC balance should be 0
      const pbBalance = await provider.connection.getTokenAccountBalance(
        userPbTokenAccount
      );
      expect(Number(pbBalance.value.amount)).to.equal(0);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalEurcInVault.toNumber()).to.equal(0);
      expect(vault.totalPbEurcSupply.toNumber()).to.equal(0);
      expect(vault.stakerCount.toNumber()).to.equal(0);

      await checkVaultInvariant(ctx);
    });

    it("returns share value after exchange rate growth", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        DEFAULT_COOLDOWN
      );
      const { user, userTokenAccount, userPbTokenAccount } =
        await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, userPbTokenAccount, 100 * ONE_EURC);

      // Fund 20 EURC in rewards → rate = 1.2x
      // shares_to_eurc(100M, 1.2 * 10^12) = 100M * 1.2 * 10^12 / 10^12 = 120M
      await fundRewards(ctx, 20 * ONE_EURC);

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );

      const balBefore = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );

      await program.methods
        .emergencyWithdraw()
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
          vaultAuthority: ctx.vaultAuthority,
          vaultTokenAccount: ctx.vaultTokenAccount,
          userTokenAccount,
          pbEurcMint: ctx.pbEurcMint,
          userPbTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      const balAfter = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );
      const recovered =
        Number(balAfter.value.amount) - Number(balBefore.value.amount);
      // Should get deposit (100) + rewards (20) = 120 EURC
      expect(recovered).to.equal(120 * ONE_EURC);
    });
  });
});

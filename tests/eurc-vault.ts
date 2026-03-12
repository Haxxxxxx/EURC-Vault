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
    it("creates a vault with valid config", async () => {
      const id = nextVaultId();
      const ctx = await setupTestVault(program, provider, id);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.vaultId.toNumber()).to.equal(id);
      expect(vault.authority.toBase58()).to.equal(
        ctx.authority.publicKey.toBase58()
      );
      expect(vault.eurcMint.toBase58()).to.equal(ctx.eurcMint.toBase58());
      expect(vault.maxCapacity.toNumber()).to.equal(DEFAULT_CAPACITY);
      expect(vault.epochDuration.toNumber()).to.equal(DEFAULT_EPOCH_DURATION);
      expect(vault.withdrawalCooldown.toNumber()).to.equal(DEFAULT_COOLDOWN);
      expect(vault.paused).to.be.false;
      expect(vault.currentEpoch.toNumber()).to.equal(1);
      expect(vault.totalDeposits.toNumber()).to.equal(0);
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

    it("first deposit creates user_stake and updates vault", async () => {
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      const depositAmount = 100 * ONE_EURC;

      await deposit(ctx, user, userTokenAccount, depositAmount);

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );
      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.depositedAmount.toNumber()).to.equal(depositAmount);
      expect(stake.user.toBase58()).to.equal(user.publicKey.toBase58());

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalDeposits.toNumber()).to.equal(depositAmount);
      expect(vault.stakerCount.toNumber()).to.equal(1);

      await checkVaultInvariant(ctx);
    });

    it("second deposit increments totals", async () => {
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 50 * ONE_EURC);
      await deposit(ctx, user, userTokenAccount, 30 * ONE_EURC);

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );
      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.depositedAmount.toNumber()).to.equal(80 * ONE_EURC);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalDeposits.toNumber()).to.equal(80 * ONE_EURC);
      // staker_count should still be 1 (same user)
      expect(vault.stakerCount.toNumber()).to.equal(1);
    });

    it("multiple users increment staker_count", async () => {
      const user1 = await setupUserWithTokens(ctx);
      const user2 = await setupUserWithTokens(ctx);

      await deposit(ctx, user1.user, user1.userTokenAccount, 50 * ONE_EURC);
      await deposit(ctx, user2.user, user2.userTokenAccount, 75 * ONE_EURC);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.stakerCount.toNumber()).to.equal(2);
      expect(vault.totalDeposits.toNumber()).to.equal(125 * ONE_EURC);
    });

    it("rejects zero deposit", async () => {
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      try {
        await deposit(ctx, user, userTokenAccount, 0);
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain("ZeroDeposit");
      }
    });

    it("rejects deposit below minimum", async () => {
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      try {
        await deposit(ctx, user, userTokenAccount, 100); // 0.0001 EURC < 1 EURC min
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
      const { user, userTokenAccount } = await setupUserWithTokens(tinyCtx);

      try {
        await deposit(tinyCtx, user, userTokenAccount, 11 * ONE_EURC);
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

      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      try {
        await deposit(ctx, user, userTokenAccount, 10 * ONE_EURC);
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
    it("initiate withdrawal sets pending state", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

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
        })
        .signers([user])
        .rpc();

      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.pendingWithdrawalAmount.toNumber()).to.equal(50 * ONE_EURC);
      expect(stake.withdrawalAvailableAt.toNumber()).to.be.greaterThan(0);
    });

    it("rejects withdrawal exceeding balance", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

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
          })
          .signers([user])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain(
          "InsufficientBalance"
        );
      }
    });

    it("rejects duplicate pending withdrawal", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

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

    it("cancel withdrawal clears pending state", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

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
        })
        .signers([user])
        .rpc();

      await program.methods
        .cancelWithdrawal()
        .accounts({
          user: user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: userStakePda,
        })
        .signers([user])
        .rpc();

      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.pendingWithdrawalAmount.toNumber()).to.equal(0);
      expect(stake.withdrawalAvailableAt.toNumber()).to.equal(0);
    });

    it("instant withdrawal with zero cooldown", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        0 // zero cooldown
      );
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

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
      expect(stake.depositedAmount.toNumber()).to.equal(50 * ONE_EURC);
      expect(stake.pendingWithdrawalAmount.toNumber()).to.equal(0);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalDeposits.toNumber()).to.equal(50 * ONE_EURC);

      await checkVaultInvariant(ctx);
    });

    it("full withdrawal decrements staker_count", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        0
      );
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

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
      expect(vault.stakerCount.toNumber()).to.equal(0);
      expect(vault.totalDeposits.toNumber()).to.equal(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Rewards
  // ────────────────────────────────────────────────────────────────────
  describe("Rewards", () => {
    it("fund_rewards updates accumulated_reward_per_share", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

      await fundRewards(ctx, 10 * ONE_EURC);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalRewardsDistributed.toNumber()).to.equal(10 * ONE_EURC);
      // acc = 10_000_000 * 10^12 / 100_000_000 = 100_000_000_000
      expect(
        vault.accumulatedRewardPerShare.toString()
      ).to.equal("100000000000");
    });

    it("claim_rewards transfers correct amount", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        0
      );
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

      // Fund 10 EURC in rewards
      await fundRewards(ctx, 10 * ONE_EURC);

      const [userStakePda] = findUserStakePda(
        ctx.vaultConfig,
        user.publicKey,
        program.programId
      );

      // Check token balance before claim
      const balBefore = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );

      await program.methods
        .claimRewards()
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

      const balAfter = await provider.connection.getTokenAccountBalance(
        userTokenAccount
      );
      const claimed =
        Number(balAfter.value.amount) - Number(balBefore.value.amount);
      expect(claimed).to.equal(10 * ONE_EURC);

      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.totalRewardsClaimed.toNumber()).to.equal(10 * ONE_EURC);

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

      await deposit(ctx, userA.user, userA.userTokenAccount, 75 * ONE_EURC);
      await deposit(ctx, userB.user, userB.userTokenAccount, 25 * ONE_EURC);

      // Fund 100 EURC in rewards
      await fundRewards(ctx, 100 * ONE_EURC);

      // Claim for both
      const [stakeA] = findUserStakePda(
        ctx.vaultConfig,
        userA.user.publicKey,
        program.programId
      );
      const [stakeB] = findUserStakePda(
        ctx.vaultConfig,
        userB.user.publicKey,
        program.programId
      );

      const balABefore = await provider.connection.getTokenAccountBalance(
        userA.userTokenAccount
      );
      await program.methods
        .claimRewards()
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
      const balAAfter = await provider.connection.getTokenAccountBalance(
        userA.userTokenAccount
      );
      const claimedA =
        Number(balAAfter.value.amount) - Number(balABefore.value.amount);

      const balBBefore = await provider.connection.getTokenAccountBalance(
        userB.userTokenAccount
      );
      await program.methods
        .claimRewards()
        .accounts({
          user: userB.user.publicKey,
          vaultConfig: ctx.vaultConfig,
          userStake: stakeB,
          vaultAuthority: ctx.vaultAuthority,
          vaultTokenAccount: ctx.vaultTokenAccount,
          userTokenAccount: userB.userTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userB.user])
        .rpc();
      const balBAfter = await provider.connection.getTokenAccountBalance(
        userB.userTokenAccount
      );
      const claimedB =
        Number(balBAfter.value.amount) - Number(balBBefore.value.amount);

      // A should get 75%, B should get 25%
      expect(claimedA).to.equal(75 * ONE_EURC);
      expect(claimedB).to.equal(25 * ONE_EURC);
    });

    it("mid-epoch deposit doesn't earn retroactive rewards", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        0
      );

      // User A deposits first
      const userA = await setupUserWithTokens(ctx);
      await deposit(ctx, userA.user, userA.userTokenAccount, 100 * ONE_EURC);

      // Fund rewards (all go to A's accumulator)
      await fundRewards(ctx, 50 * ONE_EURC);

      // User B deposits AFTER rewards — should not earn them retroactively
      const userB = await setupUserWithTokens(ctx);
      await deposit(ctx, userB.user, userB.userTokenAccount, 100 * ONE_EURC);

      const [stakeB] = findUserStakePda(
        ctx.vaultConfig,
        userB.user.publicKey,
        program.programId
      );

      // B should have 0 pending rewards
      try {
        await program.methods
          .claimRewards()
          .accounts({
            user: userB.user.publicKey,
            vaultConfig: ctx.vaultConfig,
            userStake: stakeB,
            vaultAuthority: ctx.vaultAuthority,
            vaultTokenAccount: ctx.vaultTokenAccount,
            userTokenAccount: userB.userTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([userB.user])
          .rpc();
        expect.fail("Should have thrown NoRewardsToClaim");
      } catch (e: any) {
        expect(e.error?.errorCode?.code || e.message).to.contain(
          "NoRewardsToClaim"
        );
      }
    });

    it("no rewards when no deposits", async () => {
      const ctx = await setupTestVault(program, provider, nextVaultId());

      // Fund rewards with zero deposits
      await fundRewards(ctx, 10 * ONE_EURC);

      // acc_reward_per_share should remain 0
      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.accumulatedRewardPerShare.toString()).to.equal("0");
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
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);

      // Deposit before pausing
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

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
        await deposit(ctx, user, userTokenAccount, 10 * ONE_EURC);
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

      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.depositedAmount.toNumber()).to.equal(50 * ONE_EURC);
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

      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

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
      expect(snapshot.totalDeposits.toNumber()).to.equal(100 * ONE_EURC);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.currentEpoch.toNumber()).to.equal(2);
    });

    it("rejects advance before epoch ends", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION, // 7 days
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
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

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

      const stake = await program.account.userStake.fetch(userStakePda);
      expect(stake.depositedAmount.toNumber()).to.equal(0);

      const vault = await program.account.vaultConfig.fetch(ctx.vaultConfig);
      expect(vault.totalDeposits.toNumber()).to.equal(0);
      expect(vault.stakerCount.toNumber()).to.equal(0);

      await checkVaultInvariant(ctx);
    });

    it("withdraws deposit + pending rewards", async () => {
      const ctx = await setupTestVault(
        program,
        provider,
        nextVaultId(),
        DEFAULT_EPOCH_DURATION,
        DEFAULT_COOLDOWN
      );
      const { user, userTokenAccount } = await setupUserWithTokens(ctx);
      await deposit(ctx, user, userTokenAccount, 100 * ONE_EURC);

      // Fund 20 EURC in rewards
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

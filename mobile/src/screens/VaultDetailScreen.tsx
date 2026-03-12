import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { GlassCard } from '../components/GlassCard';
import { CapacityBar } from '../components/CapacityBar';
import { EpochCountdown } from '../components/EpochCountdown';
import { useVaultData } from '../hooks/useVaultData';
import { useVaultStore } from '../store/useVaultStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatEurc, formatApy, formatEurcCompact } from '../lib/formatters';
import { EURC_DECIMALS } from '../lib/constants';

type Tab = 'deposit' | 'withdraw';

export function VaultDetailScreen() {
  const route = useRoute<any>();
  const vaultId = route.params?.vaultId as string;
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;
  const { vault, userStake } = useVaultData(vaultId);
  const [activeTab, setActiveTab] = useState<Tab>('deposit');
  const [amount, setAmount] = useState('');

  if (!vault) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          Vault not found
        </Text>
      </View>
    );
  }

  const parsedAmount = parseFloat(amount) || 0;
  const baseUnits = Math.floor(parsedAmount * Math.pow(10, EURC_DECIMALS));
  const monthlyEarnings = parsedAmount * (vault.apy / 100 / 12);
  const yearlyEarnings = parsedAmount * (vault.apy / 100);
  const userSharePct = vault.totalDeposits > 0 && userStake
    ? ((userStake.depositedAmount / vault.totalDeposits) * 100).toFixed(2)
    : '0.00';

  const handleAction = () => {
    if (baseUnits <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    Alert.alert(
      activeTab === 'deposit' ? 'Deposit' : 'Withdraw',
      `${activeTab === 'deposit' ? 'Deposit' : 'Withdraw'} ${parsedAmount.toFixed(2)} EURC?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => setAmount('') },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Vault Header */}
        <GlassCard>
          <Text style={[styles.vaultName, { color: theme.textPrimary }]}>
            {vault.name}
          </Text>
          <Text style={[styles.apyDisplay, { color: theme.success }]}>
            {formatApy(vault.apy)}
          </Text>
          <Text style={[styles.apyLabel, { color: theme.textSecondary }]}>
            Annual Percentage Yield
          </Text>
        </GlassCard>

        {/* Capacity */}
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            VAULT CAPACITY
          </Text>
          <CapacityBar current={vault.totalDeposits} max={vault.maxCapacity} />
        </GlassCard>

        {/* Epoch Countdown */}
        <GlassCard style={styles.sectionCard}>
          <EpochCountdown
            epochStartTime={vault.epochStartTime}
            epochDuration={vault.epochDuration}
            currentEpoch={vault.currentEpoch}
          />
        </GlassCard>

        {/* Your Position */}
        {userStake && (
          <GlassCard style={styles.sectionCard}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              YOUR POSITION
            </Text>
            <View style={styles.positionGrid}>
              <View style={styles.positionItem}>
                <Text style={[styles.positionValue, { color: theme.textPrimary }]}>
                  {formatEurc(userStake.depositedAmount)}
                </Text>
                <Text style={[styles.positionLabel, { color: theme.textTertiary }]}>
                  Deposited
                </Text>
              </View>
              <View style={styles.positionItem}>
                <Text style={[styles.positionValue, { color: theme.success }]}>
                  +{formatEurc(userStake.pendingRewards)}
                </Text>
                <Text style={[styles.positionLabel, { color: theme.textTertiary }]}>
                  Pending Rewards
                </Text>
              </View>
              <View style={styles.positionItem}>
                <Text style={[styles.positionValue, { color: theme.textPrimary }]}>
                  {userSharePct}%
                </Text>
                <Text style={[styles.positionLabel, { color: theme.textTertiary }]}>
                  Your Share
                </Text>
              </View>
              <View style={styles.positionItem}>
                <Text style={[styles.positionValue, { color: theme.textPrimary }]}>
                  {formatEurc(userStake.totalRewardsClaimed)}
                </Text>
                <Text style={[styles.positionLabel, { color: theme.textTertiary }]}>
                  Total Claimed
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* Deposit / Withdraw Tabs */}
        <GlassCard style={styles.sectionCard}>
          <View style={[styles.tabBar, { backgroundColor: theme.border }]}>
            <TouchableOpacity
              onPress={() => { setActiveTab('deposit'); setAmount(''); }}
              style={[
                styles.tab,
                activeTab === 'deposit' && { backgroundColor: theme.accent },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'deposit' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                Deposit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setActiveTab('withdraw'); setAmount(''); }}
              style={[
                styles.tab,
                activeTab === 'withdraw' && { backgroundColor: theme.accent },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'withdraw' ? '#FFFFFF' : theme.textSecondary },
                ]}
              >
                Withdraw
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.textPrimary,
                  borderColor: theme.glassBorder,
                  backgroundColor: theme.glass,
                },
              ]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.textTertiary}
            />
            <TouchableOpacity
              onPress={() => {
                if (activeTab === 'withdraw' && userStake) {
                  setAmount(
                    (userStake.depositedAmount / Math.pow(10, EURC_DECIMALS)).toString()
                  );
                }
              }}
              style={[styles.maxButton, { backgroundColor: theme.accentLight }]}
            >
              <Text style={[styles.maxText, { color: theme.accent }]}>MAX</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'deposit' && parsedAmount > 0 && (
            <View style={styles.projections}>
              <View style={styles.projectionRow}>
                <Text style={[styles.projectionLabel, { color: theme.textSecondary }]}>
                  Monthly Earnings
                </Text>
                <Text style={[styles.projectionValue, { color: theme.success }]}>
                  ~{monthlyEarnings.toFixed(2)} EURC
                </Text>
              </View>
              <View style={styles.projectionRow}>
                <Text style={[styles.projectionLabel, { color: theme.textSecondary }]}>
                  Yearly Earnings
                </Text>
                <Text style={[styles.projectionValue, { color: theme.success }]}>
                  ~{yearlyEarnings.toFixed(2)} EURC
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handleAction}
            style={[styles.actionButton, { backgroundColor: theme.accent }]}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>
              {activeTab === 'deposit' ? 'Deposit EURC' : 'Withdraw EURC'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Vault Stats */}
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            VAULT STATS
          </Text>
          <View style={styles.statsGrid}>
            {[
              { label: 'TVL', value: formatEurcCompact(vault.totalDeposits) },
              { label: 'Stakers', value: vault.stakerCount.toString() },
              { label: 'Epoch', value: `#${vault.currentEpoch}` },
              { label: 'Cooldown', value: vault.withdrawalCooldown > 0 ? `${vault.withdrawalCooldown / 86400}d` : 'Instant' },
            ].map((stat) => (
              <View key={stat.label} style={styles.statsItem}>
                <Text style={[styles.statsValue, { color: theme.textPrimary }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statsLabel, { color: theme.textTertiary }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  errorText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: 100,
  },
  vaultName: {
    ...typography.heading2,
    marginBottom: 8,
  },
  apyDisplay: {
    fontSize: 40,
    fontWeight: '200',
    letterSpacing: -1,
  },
  apyLabel: {
    ...typography.caption,
    marginTop: 4,
  },
  sectionCard: {
    marginTop: 12,
  },
  sectionLabel: {
    ...typography.label,
    marginBottom: 12,
  },
  positionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  positionItem: {
    width: '50%',
    paddingVertical: 8,
  },
  positionValue: {
    ...typography.body,
    fontWeight: '500',
  },
  positionLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '400',
  },
  maxButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
  },
  maxText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  projections: {
    marginBottom: 16,
  },
  projectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  projectionLabel: {
    ...typography.bodySmall,
  },
  projectionValue: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsItem: {
    width: '50%',
    paddingVertical: 8,
  },
  statsValue: {
    ...typography.heading3,
  },
  statsLabel: {
    ...typography.caption,
    marginTop: 2,
  },
});

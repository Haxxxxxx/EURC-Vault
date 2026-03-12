import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BalanceHero } from '../components/BalanceHero';
import { GlassCard } from '../components/GlassCard';
import { VaultListItem } from '../components/VaultListItem';
import { WalletButton } from '../components/WalletButton';
import { useVaultData } from '../hooks/useVaultData';
import { useVaultStore } from '../store/useVaultStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatEurc, formatEurcCompact } from '../lib/formatters';
import { MiniSparkline } from '../components/charts/MiniSparkline';
import { usePortfolioSparkline } from '../hooks/useChartData';

export function PortfolioScreen() {
  const navigation = useNavigation<any>();
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;
  const selectVault = useVaultStore((s) => s.selectVault);
  const { vaults, totalStaked, totalPendingRewards, totalRewardsClaimed, refresh } =
    useVaultData();
  const sparklineData = usePortfolioSparkline(7, totalStaked / 1_000_000 || 60000);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleVaultPress = (vaultId: string) => {
    selectVault(vaultId);
    navigation.navigate('VaultDetail', { vaultId });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Portfolio</Text>
        <WalletButton />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.heroCard}>
          <BalanceHero amount={totalStaked} label="TOTAL STAKED" />

          <View style={styles.sparklineContainer}>
            <MiniSparkline data={sparklineData} height={50} width={280} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Pending
              </Text>
              <Text style={[styles.statValue, { color: theme.success }]}>
                +{formatEurcCompact(totalPendingRewards)}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.stat}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Claimed
              </Text>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                {formatEurcCompact(totalRewardsClaimed)}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.divider }]} />
            <View style={styles.stat}>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Vaults
              </Text>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                {vaults.length}
              </Text>
            </View>
          </View>
        </GlassCard>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          ACTIVE VAULTS
        </Text>

        {vaults.map((vault) => (
          <VaultListItem
            key={vault.id}
            vault={vault}
            onPress={() => handleVaultPress(vault.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  title: {
    ...typography.heading1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  heroCard: {
    marginBottom: 24,
  },
  sparklineContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  statLabel: {
    ...typography.caption,
    marginBottom: 4,
  },
  statValue: {
    ...typography.body,
    fontWeight: '500',
  },
  sectionTitle: {
    ...typography.label,
    marginBottom: 12,
  },
});

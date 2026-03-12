import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GlassCard } from './GlassCard';
import { CapacityBar } from './CapacityBar';
import { useVaultStore } from '../store/useVaultStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatEurcCompact, formatApy } from '../lib/formatters';
import type { VaultInfo } from '../store/useVaultStore';

interface VaultListItemProps {
  vault: VaultInfo;
  onPress: () => void;
}

export function VaultListItem({ vault, onPress }: VaultListItemProps) {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <GlassCard style={styles.card}>
        <View style={styles.header}>
          <Text style={[styles.name, { color: theme.textPrimary }]}>
            {vault.name}
          </Text>
          <View style={[styles.apyBadge, { backgroundColor: theme.successLight }]}>
            <Text style={[styles.apyText, { color: theme.success }]}>
              {formatApy(vault.apy)} APY
            </Text>
          </View>
        </View>

        <CapacityBar current={vault.totalDeposits} max={vault.maxCapacity} />

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>TVL</Text>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>
              {formatEurcCompact(vault.totalDeposits)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Stakers</Text>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>
              {vault.stakerCount}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Epoch</Text>
            <Text style={[styles.statValue, { color: theme.textPrimary }]}>
              #{vault.currentEpoch}
            </Text>
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    ...typography.heading3,
    flex: 1,
  },
  apyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  apyText: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    ...typography.caption,
    marginBottom: 2,
  },
  statValue: {
    ...typography.body,
    fontWeight: '500',
  },
});

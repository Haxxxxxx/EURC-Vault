import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useVaultStore } from '../store/useVaultStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatEurc } from '../lib/formatters';

interface BalanceHeroProps {
  amount: number;
  label?: string;
}

export function BalanceHero({ amount, label = 'Total Staked' }: BalanceHeroProps) {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.balance, { color: theme.textPrimary }]}>
        {formatEurc(amount, false)}
      </Text>
      <Text style={[styles.suffix, { color: theme.textTertiary }]}>
        EURC
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  label: {
    ...typography.label,
    marginBottom: 8,
  },
  balance: {
    ...typography.heroBalance,
  },
  suffix: {
    ...typography.bodySmall,
    marginTop: 4,
  },
});

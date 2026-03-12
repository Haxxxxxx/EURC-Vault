import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useVaultStore } from '../store/useVaultStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatEurc } from '../lib/formatters';
import type { TransactionRecord } from '../store/useVaultStore';

interface TransactionItemProps {
  transaction: TransactionRecord;
}

const TYPE_CONFIG = {
  deposit: { label: 'Deposit', sign: '+', color: 'success' as const },
  withdrawal: { label: 'Withdrawal', sign: '-', color: 'warning' as const },
  reward_claim: { label: 'Reward', sign: '+', color: 'success' as const },
  emergency: { label: 'Emergency', sign: '-', color: 'error' as const },
};

export function TransactionItem({ transaction }: TransactionItemProps) {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;
  const config = TYPE_CONFIG[transaction.type];

  const date = new Date(transaction.timestamp);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={[styles.container, { borderBottomColor: theme.divider }]}>
      <View style={styles.left}>
        <Text style={[styles.type, { color: theme.textPrimary }]}>
          {config.label}
        </Text>
        <Text style={[styles.date, { color: theme.textTertiary }]}>
          {dateStr} &middot; {transaction.txHash}
        </Text>
      </View>
      <Text style={[styles.amount, { color: theme[config.color] }]}>
        {config.sign}{formatEurc(transaction.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  left: {
    flex: 1,
  },
  type: {
    ...typography.body,
    fontWeight: '500',
  },
  date: {
    ...typography.caption,
    marginTop: 2,
  },
  amount: {
    ...typography.body,
    fontWeight: '500',
  },
});

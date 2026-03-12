import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { TransactionItem } from '../components/TransactionItem';
import { useVaultStore, TransactionRecord } from '../store/useVaultStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type FilterType = 'all' | 'deposit' | 'withdrawal' | 'reward_claim';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'deposit', label: 'Deposits' },
  { key: 'withdrawal', label: 'Withdrawals' },
  { key: 'reward_claim', label: 'Rewards' },
];

export function HistoryScreen() {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;
  const transactions = useVaultStore((s) => s.transactions);
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = filter === 'all'
    ? transactions
    : transactions.filter((t) => t.type === filter);

  const renderItem = ({ item }: { item: TransactionRecord }) => (
    <TransactionItem transaction={item} />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>History</Text>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === f.key ? theme.accent : theme.glass,
                borderColor: filter === f.key ? theme.accent : theme.glassBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f.key ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
            No transactions yet
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    ...typography.heading1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterText: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: 60,
  },
});

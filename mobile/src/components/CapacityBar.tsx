import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useVaultStore } from '../store/useVaultStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatEurcCompact } from '../lib/formatters';

interface CapacityBarProps {
  current: number;
  max: number;
}

export function CapacityBar({ current, max }: CapacityBarProps) {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const remaining = max - current;

  return (
    <View>
      <View style={[styles.barBackground, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${percentage}%`,
              backgroundColor: theme.accent,
              shadowColor: theme.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 6,
            },
          ]}
        />
      </View>
      <View style={styles.labels}>
        <Text style={[styles.labelText, { color: theme.textTertiary }]}>
          {percentage.toFixed(1)}% filled
        </Text>
        <Text style={[styles.labelText, { color: theme.textTertiary }]}>
          {formatEurcCompact(remaining)} remaining
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  labelText: {
    ...typography.caption,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useVaultStore } from '../../store/useVaultStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface RewardsTimelineChartProps {
  data: Array<{ value: number; label?: string }>;
}

export function RewardsTimelineChart({ data }: RewardsTimelineChartProps) {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;

  if (data.length === 0) return null;

  const lastValue = data[data.length - 1]?.value ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textSecondary }]}>
          REWARDS EARNED (30D)
        </Text>
        <Text style={[styles.totalValue, { color: theme.success }]}>
          +€{lastValue.toFixed(2)}
        </Text>
      </View>
      <LineChart
        data={data}
        height={100}
        hideDataPoints
        curved
        thickness={2}
        color={theme.success}
        areaChart
        startFillColor={theme.success}
        startOpacity={0.25}
        endFillColor={theme.success}
        endOpacity={0}
        hideYAxisText
        yAxisThickness={0}
        xAxisThickness={0}
        hideRules
        xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 9, fontWeight: '300' }}
        isAnimated
        animationDuration={800}
        adjustToWidth
        disableScroll
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    ...typography.label,
  },
  totalValue: {
    ...typography.body,
    fontWeight: '500',
  },
});

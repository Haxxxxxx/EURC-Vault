import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useVaultStore } from '../../store/useVaultStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface EarningsProjectionChartProps {
  data: Array<{ value: number; label?: string }>;
}

export function EarningsProjectionChart({ data }: EarningsProjectionChartProps) {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;

  if (data.length === 0) return null;

  const barData = data.map((d) => ({
    value: d.value,
    label: d.label || '',
    frontColor: theme.accent,
    gradientColor: theme.success,
    topLabelComponent: () => (
      <Text style={[styles.barLabel, { color: theme.success }]}>
        €{d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}k` : d.value.toFixed(0)}
      </Text>
    ),
  }));

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.textSecondary }]}>
        PROJECTED EARNINGS
      </Text>
      <BarChart
        data={barData}
        height={140}
        barWidth={36}
        spacing={20}
        noOfSections={4}
        barBorderRadius={6}
        yAxisThickness={0}
        xAxisThickness={0}
        hideRules
        xAxisLabelTextStyle={{ color: theme.textTertiary, fontSize: 11, fontWeight: '300' }}
        yAxisTextStyle={{ color: theme.textTertiary, fontSize: 10 }}
        hideYAxisText
        isAnimated
        animationDuration={600}
        disableScroll
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  title: {
    ...typography.label,
    marginBottom: 12,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 4,
  },
});

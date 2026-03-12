import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useVaultStore } from '../../store/useVaultStore';
import { colors } from '../../theme/colors';

interface MiniSparklineProps {
  data: Array<{ value: number; label?: string }>;
  height?: number;
  width?: number;
}

export function MiniSparkline({ data, height = 60, width = 200 }: MiniSparklineProps) {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;

  if (data.length === 0) return null;

  return (
    <View style={styles.container}>
      <LineChart
        data={data}
        height={height}
        width={width}
        hideDataPoints
        hideYAxisText
        hideAxesAndRules
        curved
        thickness={2}
        color={theme.accent}
        areaChart
        startFillColor={theme.accent}
        startOpacity={0.3}
        endFillColor={theme.accent}
        endOpacity={0}
        animateOnDataChange
        animationDuration={800}
        isAnimated
        adjustToWidth
        disableScroll
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    overflow: 'hidden',
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCountdown } from '../hooks/useCountdown';
import { useVaultStore } from '../store/useVaultStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface EpochCountdownProps {
  epochStartTime: number;
  epochDuration: number;
  currentEpoch: number;
}

export function EpochCountdown({
  epochStartTime,
  epochDuration,
  currentEpoch,
}: EpochCountdownProps) {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;
  const { secondsRemaining, progress } = useCountdown(epochStartTime, epochDuration);

  const days = Math.floor(secondsRemaining / 86400);
  const hours = Math.floor((secondsRemaining % 86400) / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = Math.floor(secondsRemaining % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>
        EPOCH #{currentEpoch} ENDS IN
      </Text>
      <View style={styles.timerRow}>
        {[
          { value: pad(days), unit: 'D' },
          { value: pad(hours), unit: 'H' },
          { value: pad(minutes), unit: 'M' },
          { value: pad(seconds), unit: 'S' },
        ].map((item, i) => (
          <React.Fragment key={item.unit}>
            {i > 0 && (
              <Text style={[styles.separator, { color: theme.textTertiary }]}>:</Text>
            )}
            <View style={styles.digitGroup}>
              <Text style={[styles.digit, { color: theme.textPrimary }]}>
                {item.value}
              </Text>
              <Text style={[styles.unit, { color: theme.textTertiary }]}>
                {item.unit}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>
      <View style={[styles.progressBg, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: theme.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  label: {
    ...typography.label,
    marginBottom: 12,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  digitGroup: {
    alignItems: 'center',
  },
  digit: {
    fontSize: 28,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
  },
  unit: {
    ...typography.caption,
    marginTop: -2,
  },
  separator: {
    fontSize: 24,
    fontWeight: '200',
    marginHorizontal: 4,
    marginBottom: 14,
  },
  progressBg: {
    height: 3,
    borderRadius: 1.5,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { WalletButton } from '../components/WalletButton';
import { useVaultStore } from '../store/useVaultStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { NETWORK, RPC_URL, PROGRAM_ID } from '../lib/constants';
import { truncateAddress } from '../lib/formatters';

export function SettingsScreen() {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;
  const toggleTheme = useVaultStore((s) => s.toggleTheme);
  const walletAddress = useVaultStore((s) => s.walletAddress);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Settings</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Wallet */}
        <GlassCard>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            WALLET
          </Text>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>
              Status
            </Text>
            <Text
              style={[
                styles.rowValue,
                { color: walletAddress ? theme.success : theme.textTertiary },
              ]}
            >
              {walletAddress ? 'Connected' : 'Not connected'}
            </Text>
          </View>
          {walletAddress && (
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>
                Address
              </Text>
              <Text style={[styles.rowValueMono, { color: theme.textSecondary }]}>
                {truncateAddress(walletAddress, 8)}
              </Text>
            </View>
          )}
          <View style={styles.buttonRow}>
            <WalletButton />
          </View>
        </GlassCard>

        {/* Appearance */}
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            APPEARANCE
          </Text>
          <TouchableOpacity onPress={toggleTheme} style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>
              Theme
            </Text>
            <Text style={[styles.rowValue, { color: theme.accent }]}>
              {isDark ? 'Dark' : 'Light'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Network */}
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            NETWORK
          </Text>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>
              Cluster
            </Text>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              {NETWORK}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>
              RPC
            </Text>
            <Text
              style={[styles.rowValueMono, { color: theme.textTertiary }]}
              numberOfLines={1}
            >
              {RPC_URL}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>
              Program
            </Text>
            <Text style={[styles.rowValueMono, { color: theme.textTertiary }]}>
              {truncateAddress(PROGRAM_ID, 6)}
            </Text>
          </View>
        </GlassCard>

        {/* About */}
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            ABOUT
          </Text>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>
              Version
            </Text>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              0.1.0
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>
              EURC Vault
            </Text>
            <Text style={[styles.rowValue, { color: theme.textSecondary }]}>
              Epoch-based staking on Solana
            </Text>
          </View>
        </GlassCard>
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sectionCard: {
    marginTop: 12,
  },
  sectionLabel: {
    ...typography.label,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowLabel: {
    ...typography.body,
  },
  rowValue: {
    ...typography.bodySmall,
  },
  rowValueMono: {
    ...typography.mono,
    maxWidth: '50%',
  },
  buttonRow: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
});

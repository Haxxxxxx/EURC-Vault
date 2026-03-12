import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useVaultStore } from '../store/useVaultStore';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { truncateAddress } from '../lib/formatters';

export function WalletButton() {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;
  const isConnected = useVaultStore((s) => s.isConnected);
  const walletAddress = useVaultStore((s) => s.walletAddress);
  const setWalletAddress = useVaultStore((s) => s.setWalletAddress);

  const handlePress = () => {
    if (isConnected) {
      setWalletAddress(null);
    } else {
      // Mock connection — replace with Phantom SDK / MWA
      const mockAddr = 'EURc' + Math.random().toString(36).substring(2, 10) + '...vault';
      setWalletAddress(mockAddr);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.button,
        {
          backgroundColor: isConnected ? theme.surface : theme.accent,
          borderColor: isConnected ? theme.glassBorder : 'transparent',
        },
      ]}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.text,
          { color: isConnected ? theme.textPrimary : '#FFFFFF' },
        ]}
      >
        {isConnected && walletAddress
          ? truncateAddress(walletAddress, 6)
          : 'Connect Wallet'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
});

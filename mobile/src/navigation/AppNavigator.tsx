import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { VaultDetailScreen } from '../screens/VaultDetailScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useVaultStore } from '../store/useVaultStore';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();
const VaultStack = createNativeStackNavigator();

function VaultStackNavigator() {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;

  return (
    <VaultStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.textPrimary,
        headerTitleStyle: { fontWeight: '500' },
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <VaultStack.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{ headerShown: false }}
      />
      <VaultStack.Screen
        name="VaultDetail"
        component={VaultDetailScreen}
        options={{ title: 'Vault', headerBackTitle: 'Back' }}
      />
    </VaultStack.Navigator>
  );
}

export function AppNavigator() {
  const isDark = useVaultStore((s) => s.isDarkMode);
  const theme = isDark ? colors.dark : colors.light;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          paddingTop: 8,
          height: 85,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="PortfolioTab"
        component={VaultStackNavigator}
        options={{
          tabBarLabel: 'Portfolio',
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: 'History',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}

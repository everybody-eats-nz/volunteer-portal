import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';
import { Brand } from '@/constants/theme';
import LoginScreen from '@/app/(auth)/login';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAuth();

  const eeLight = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: Brand.warmWhite,
      card: '#ffffff',
      primary: Brand.green,
    },
  };

  const eeDark = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0f1114',
      card: '#1a1d21',
      primary: Brand.greenLight,
    },
  };

  // Show login screen if not authenticated (no redirect, no navigation)
  if (!isLoading && !isAuthenticated) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? eeDark : eeLight}>
        <LoginScreen />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? eeDark : eeLight}>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'house', selected: 'house.fill' }}
            md="home"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="shifts">
          <NativeTabs.Trigger.Label>Shifts</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'calendar', selected: 'calendar' }}
            md="event"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="ask">
          <NativeTabs.Trigger.Label>Ask</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'questionmark.circle', selected: 'questionmark.circle.fill' }}
            md="help"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person', selected: 'person.fill' }}
            md="person"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}

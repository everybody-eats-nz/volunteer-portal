import { useMemo } from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTeamUnreadCount } from '@/hooks/use-team-unread';
import { useAdminUnreadCount } from '@/hooks/use-admin';
import { useDriverState } from '@/hooks/use-van';
import { useAuth } from '@/lib/auth';
import { Colors, Tones } from '@/constants/theme';
import LoginScreen from '@/app/(auth)/login';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const teamUnreadCount = useTeamUnreadCount(isAuthenticated);
  const isAdmin = user?.role === 'ADMIN';
  const adminUnreadCount = useAdminUnreadCount(isAuthenticated && isAdmin);
  // Driving is a capability, not a role: the tab is gated on an APPROVED
  // DriverProfile, never on user.role, so a volunteer who also drives stays a
  // volunteer. An admin who drives would get six triggers and iOS would bury
  // Profile under "More", so for them Help moves into the Admin hub (as rows
  // for the assistant and the team thread) and the bar stays at five.
  const { data: driver } = useDriverState(isAuthenticated);
  const canDrive = driver?.canDrive === true;
  const showHelpTab = !(isAdmin && canDrive);
  const colors = Colors[colorScheme];

  const eeLight = useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: Colors.light.background,
      card: Colors.light.card,
      text: Colors.light.text,
      border: Colors.light.border,
      primary: Colors.light.primary,
    },
  }), []);

  const eeDark = useMemo(() => ({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: Colors.dark.background,
      card: Colors.dark.card,
      text: Colors.dark.text,
      border: Colors.dark.border,
      primary: Colors.dark.tint,
    },
  }), []);

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
      {/* NativeTabs ignores the navigation theme's `primary`, so without an
          explicit tint iOS paints the active tab system blue and Android uses
          its Material You wallpaper colour. Both get the brand tint; Android
          also gets a forest active indicator and ripple. */}
      <NativeTabs
        tintColor={colors.tint}
        indicatorColor={Tones[colorScheme].forest.bg}
        rippleColor={Tones[colorScheme].forest.bg}
      >
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

        {showHelpTab && (
          <NativeTabs.Trigger name="chat">
            <NativeTabs.Trigger.Label>Help</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: 'sparkles', selected: 'sparkles' }}
              md="chat"
            />
            {teamUnreadCount > 0 && (
              <NativeTabs.Trigger.Badge>
                {teamUnreadCount > 99 ? '99+' : String(teamUnreadCount)}
              </NativeTabs.Trigger.Badge>
            )}
          </NativeTabs.Trigger>
        )}

        {canDrive && (
          <NativeTabs.Trigger name="drive">
            <NativeTabs.Trigger.Label>Drive</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: 'car', selected: 'car.fill' }}
              md="directions_car"
            />
          </NativeTabs.Trigger>
        )}

        {isAdmin && (
          <NativeTabs.Trigger name="admin">
            <NativeTabs.Trigger.Label>Admin</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon
              sf={{ default: 'shield', selected: 'shield.fill' }}
              md="shield"
            />
            {adminUnreadCount > 0 && (
              <NativeTabs.Trigger.Badge>
                {adminUnreadCount > 99 ? '99+' : String(adminUnreadCount)}
              </NativeTabs.Trigger.Badge>
            )}
          </NativeTabs.Trigger>
        )}

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

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo } from 'react';
import 'react-native-reanimated';

import {
  LibreFranklin_400Regular,
  LibreFranklin_500Medium,
  LibreFranklin_600SemiBold,
  LibreFranklin_700Bold,
} from '@expo-google-fonts/libre-franklin';
import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';
import { useNotificationsStore } from '@/hooks/use-notifications';
import { Brand } from '@/constants/theme';
import { AuthGate } from '@/components/auth-gate';
import { EulaModal } from '@/components/eula-modal';
import { navigateToNotificationTarget } from '@/lib/notification-routing';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isLoading, restoreSession } = useAuth();

  const [fontsLoaded] = useFonts({
    LibreFranklin_400Regular,
    LibreFranklin_500Medium,
    LibreFranklin_600SemiBold,
    LibreFranklin_700Bold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Tap handling: navigate when the user taps a push notification (both
  // the runtime listener and any notification that launched the app from
  // a cold start).
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateToNotificationTarget(
          response.notification.request.content.data?.actionUrl,
        );
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        navigateToNotificationTarget(
          response.notification.request.content.data?.actionUrl,
        );
      },
    );
    return () => subscription.remove();
  }, []);

  // Keep the OS app-icon badge in sync with the store's unreadCount.
  // Push notifications increment the badge; only we can clear it once the
  // user reads things in-app.
  useEffect(() => {
    const applyBadge = (count: number) => {
      Notifications.setBadgeCountAsync(count).catch(() => {});
    };
    applyBadge(useNotificationsStore.getState().unreadCount);
    return useNotificationsStore.subscribe((state, prev) => {
      if (state.unreadCount !== prev.unreadCount) applyBadge(state.unreadCount);
    });
  }, []);

  useEffect(() => {
    if (!isLoading && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, fontsLoaded]);

  const eeLight = useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: Brand.warmWhite,
      card: '#ffffff',
      primary: Brand.green,
    },
  }), []);

  const eeDark = useMemo(() => ({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0f1114',
      card: '#1a1d21',
      primary: Brand.greenLight,
    },
  }), []);

  const handleEulaAccepted = useCallback(() => {}, []);

  if (isLoading || !fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? eeDark : eeLight}>
      <EulaModal onAccepted={handleEulaAccepted} />
      <AuthGate>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen
            name="shift/[id]"
            options={{
              headerShown: true,
              headerTransparent: true,
              headerBackTitle: 'Back',
              title: '',
            }}
          />
          <Stack.Screen
            name="friend/[id]"
            options={{
              headerShown: true,
              headerTransparent: true,
              headerBackTitle: 'Back',
              title: '',
            }}
          />
          <Stack.Screen
            name="user/[id]"
            options={{
              headerShown: true,
              headerTransparent: true,
              headerBackTitle: 'Back',
              title: '',
            }}
          />
          <Stack.Screen
            name="profile/edit"
            options={{
              headerShown: true,
              headerTransparent: true,
              headerBackTitle: 'Profile',
              title: '',
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              headerShown: true,
              headerBackTitle: 'Back',
              title: '',
            }}
          />
        </Stack>
      </AuthGate>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

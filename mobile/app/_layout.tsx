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
        </Stack>
      </AuthGate>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

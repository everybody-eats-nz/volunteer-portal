import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PostHogProvider } from 'posthog-react-native';
import React, { useEffect, useMemo } from 'react';
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
import {
  getUnreadCount,
  subscribeToNotificationsUnread,
} from '@/hooks/use-notifications';
import { Brand } from '@/constants/theme';
import { AchievementCelebration } from '@/components/achievement-celebration';
import { AuthGate } from '@/components/auth-gate';
import { OnboardingFlow } from '@/components/onboarding-flow';
import { useInitAchievementCelebration } from '@/hooks/use-achievement-celebration';
import { navigateToNotificationTarget } from '@/lib/notification-routing';
import { posthog } from '@/lib/posthog';
import { queryClient, setupFocusManager } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isLoading, isAuthenticated, restoreSession } = useAuth();
  useInitAchievementCelebration();

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

  useEffect(() => setupFocusManager(), []);

  // Tap handling: navigate when the user taps a push notification (both
  // the runtime listener and any notification that launched the app from
  // a cold start). Gated on the app being ready to navigate — otherwise
  // a cold-start tap fires before <Stack> mounts and the push is lost,
  // leaving the app stuck on splash.
  useEffect(() => {
    if (isLoading || !fontsLoaded || !isAuthenticated) return;

    let cancelled = false;
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled || !response) return;
      posthog?.capture('notification_tapped', {
        action_url: (response.notification.request.content.data?.actionUrl as string) ?? null,
        cold_start: true,
      });
      navigateToNotificationTarget(
        response.notification.request.content.data?.actionUrl,
      );
      // Clear so a later auth flip (logout → login) doesn't replay the
      // original launch notification.
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        posthog?.capture('notification_tapped', {
          action_url: (response.notification.request.content.data?.actionUrl as string) ?? null,
          cold_start: false,
        });
        navigateToNotificationTarget(
          response.notification.request.content.data?.actionUrl,
        );
      },
    );
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [isLoading, fontsLoaded, isAuthenticated]);

  // Keep the OS app-icon badge in sync with the notifications query cache.
  // Push notifications increment the badge; only we can clear it once the
  // user reads things in-app.
  useEffect(() => {
    const applyBadge = (count: number) => {
      Notifications.setBadgeCountAsync(count).catch(() => {});
    };
    applyBadge(getUnreadCount(queryClient));
    return subscribeToNotificationsUnread(queryClient, applyBadge);
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

  if (isLoading || !fontsLoaded) {
    return null;
  }

  const appTree = (
    <ThemeProvider value={colorScheme === 'dark' ? eeDark : eeLight}>
      <AuthGate>
        <OnboardingFlow />
        <AchievementCelebration />
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
          <Stack.Screen name="help/ai" options={{ headerShown: false }} />
          <Stack.Screen name="help/team" options={{ headerShown: false }} />
        </Stack>
      </AuthGate>
      <StatusBar style="auto" />
    </ThemeProvider>
  );

  const withPosthog = posthog ? (
    <PostHogProvider client={posthog}>{appTree}</PostHogProvider>
  ) : (
    appTree
  );

  return (
    <QueryClientProvider client={queryClient}>{withPosthog}</QueryClientProvider>
  );
}

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
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

  return (
    <ThemeProvider value={colorScheme === 'dark' ? eeDark : eeLight}>
      <AuthGate>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen
            name="shift/[id]"
            options={{
              headerShown: true,
              title: 'Shift',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="friend/[id]"
            options={{
              headerShown: true,
              title: 'Friend',
              headerBackTitle: 'Back',
            }}
          />
        </Stack>
      </AuthGate>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

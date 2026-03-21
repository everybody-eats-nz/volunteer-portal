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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="shift/[id]" />
        <Stack.Screen name="friend/[id]" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

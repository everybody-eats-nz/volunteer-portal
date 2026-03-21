import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Wraps React Native's useColorScheme to always return 'light' | 'dark'.
 * SDK 55 added 'unspecified' as a possible value — we treat it as 'light'.
 */
export function useColorScheme(): 'light' | 'dark' {
  const scheme = useRNColorScheme();
  return scheme === 'dark' ? 'dark' : 'light';
}

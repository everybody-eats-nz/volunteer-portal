import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import type { AppStateStatus } from 'react-native';
import { AppState, Platform } from 'react-native';

import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mobile networks are flaky; one silent retry covers most blips.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Wire React Query's `focusManager` to React Native's AppState so queries
 * revalidate when the user foregrounds the app — the RN equivalent of
 * web's `window.focus`.
 */
export function setupFocusManager() {
  const onAppStateChange = (status: AppStateStatus) => {
    if (Platform.OS !== 'web') {
      focusManager.setFocused(status === 'active');
    }
  };
  const subscription = AppState.addEventListener('change', onAppStateChange);
  return () => subscription.remove();
}

/**
 * Tell React Query the app is always "online" — RN doesn't ship a NetInfo
 * adapter by default, and we'd rather let requests fire and fail than
 * silently park them. Swap in @react-native-community/netinfo later if we
 * want true offline handling.
 */
onlineManager.setOnline(true);

import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { removeOldestQuery } from '@tanstack/react-query-persist-client';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type { AppStateStatus } from 'react-native';
import { AppState, Platform } from 'react-native';

import { ApiError } from './api';

/**
 * How long a restored cache entry stays usable. Queries still revalidate on
 * mount, so this is only about what we can paint *immediately* on a cold
 * start — a day-old shift card that refreshes under the user beats a spinner.
 */
const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

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
      // Must be >= PERSIST_MAX_AGE: React Query drops a restored entry whose
      // age already exceeds gcTime, which would defeat the whole point of
      // persisting it.
      gcTime: PERSIST_MAX_AGE,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: false,
    },
  },
});

const CACHE_KEY = 'ee-query-cache';

/**
 * Exactly the queries that decide whether the home tab paints on a cold start.
 *
 * Deliberately narrow. The whole cache is serialized into a single AsyncStorage
 * entry, and Android's SQLite-backed store caps how big one row may be — so
 * this is an allowlist of small, high-value payloads, not "everything we can".
 * Notably absent:
 *  - `shifts.list`, the Shifts tab's quarter-of-every-restaurant dataset. It
 *    runs to over a megabyte on its own and isn't the landing screen.
 *  - `feed.comments`, one entry per opened post, unbounded over a session.
 *  - admin/chat/message threads, which churn fast and carry conversation data
 *    we'd rather not park on disk.
 */
const PERSISTED_KEYS: readonly (readonly string[])[] = [
  ['shifts', 'home'],
  ['feed', 'list'],
  ['profile', 'me'],
  ['notifications', 'list'],
];

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_KEY,
  // Writes are debounced: the home tab settles several queries at once and we
  // don't want a serialize-and-write per query.
  throttleTime: 2_000,
  // If a write ever fails on size, shed the oldest query and try again rather
  // than dropping the whole cache.
  retry: removeOldestQuery,
});

/**
 * Bump when a persisted payload's shape changes, so an old build's cache is
 * discarded rather than rendered. The app version is folded in so every
 * release starts from a clean cache regardless.
 */
const CACHE_SCHEMA_VERSION = 1;
const buster = `v${CACHE_SCHEMA_VERSION}-${Constants.expoConfig?.version ?? 'dev'}`;

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: PERSIST_MAX_AGE,
  buster,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      if (query.state.status !== 'success') return false;
      return PERSISTED_KEYS.some((key) =>
        key.every((segment, i) => query.queryKey[i] === segment)
      );
    },
  },
};

/**
 * Drop both the in-memory and on-disk caches. Called on every session
 * boundary (sign-in, sign-out, account deletion, expired token) so one
 * person's shifts and feed can never paint for the next person to sign in
 * on this device.
 */
export async function clearQueryCache() {
  queryClient.clear();
  try {
    await persister.removeClient();
  } catch (error) {
    // Best-effort: a storage hiccup must not strand the sign-out flow. The
    // in-memory clear above has already happened, and `buster` plus maxAge
    // bound how long a stale entry could survive.
    console.warn('[query-client] Failed to clear persisted cache:', error);
  }
}

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

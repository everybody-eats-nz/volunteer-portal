import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';

import type { Achievement } from '@/lib/dummy-data';

const LAST_SEEN_KEY = 'achievement_celebration_last_seen';

type State = {
  /** ISO timestamp of the most recent unlock the user has acknowledged. */
  lastSeenAt: string | null;
  /** Achievements waiting to be celebrated. */
  pending: Achievement[];
  /** True after we've read lastSeenAt from storage. Prevents queueing on cold start before we know the baseline. */
  isReady: boolean;

  init: () => Promise<void>;
  queueIfNew: (achievements: Achievement[]) => void;
  dismiss: () => Promise<void>;
};

export const useAchievementCelebrationStore = create<State>((set, get) => ({
  lastSeenAt: null,
  pending: [],
  isReady: false,

  init: async () => {
    if (get().isReady) return;
    try {
      const stored = await AsyncStorage.getItem(LAST_SEEN_KEY);
      if (stored) {
        set({ lastSeenAt: stored, isReady: true });
      } else {
        // First run: baseline at "now" so we don't celebrate every existing
        // achievement the user has already earned on web.
        const now = new Date().toISOString();
        await AsyncStorage.setItem(LAST_SEEN_KEY, now);
        set({ lastSeenAt: now, isReady: true });
      }
    } catch {
      // If storage fails, baseline at "now" in memory so we don't spam.
      set({ lastSeenAt: new Date().toISOString(), isReady: true });
    }
  },

  queueIfNew: (achievements) => {
    const { isReady, lastSeenAt, pending } = get();
    if (!isReady || !lastSeenAt) return;

    const baseline = new Date(lastSeenAt).getTime();
    const alreadyPending = new Set(pending.map((a) => a.id));

    const fresh = achievements.filter((a) => {
      if (!a.unlockedAt) return false;
      if (alreadyPending.has(a.id)) return false;
      return new Date(a.unlockedAt).getTime() > baseline;
    });

    if (fresh.length === 0) return;

    set({ pending: [...pending, ...fresh] });
  },

  dismiss: async () => {
    const now = new Date().toISOString();
    set({ pending: [], lastSeenAt: now });
    try {
      await AsyncStorage.setItem(LAST_SEEN_KEY, now);
    } catch {
      // Non-fatal: in-memory state is still updated.
    }
  },
}));

/**
 * Mount once near the app root to load the persisted baseline. Other call
 * sites can read the store directly without waiting for init themselves.
 */
export function useInitAchievementCelebration() {
  const init = useAchievementCelebrationStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);
}

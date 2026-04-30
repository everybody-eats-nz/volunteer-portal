import { useEffect } from "react";
import { AppState } from "react-native";
import { create } from "zustand";

import { fetchTeamUnreadCount } from "@/lib/messages";

const POLL_INTERVAL_MS = 30000;

type TeamUnreadState = {
  count: number;
  fetch: () => Promise<void>;
  setCount: (count: number) => void;
};

export const useTeamUnreadStore = create<TeamUnreadState>((set) => ({
  count: 0,
  fetch: async () => {
    try {
      const { count } = await fetchTeamUnreadCount();
      set({ count });
    } catch {
      // Silent — badge just won't update on this tick.
    }
  },
  setCount: (count) => set({ count }),
}));

/**
 * Polls the team unread count and refreshes when the app returns to the
 * foreground. Mount once at the tab layout level.
 */
export function useTeamUnreadPolling(enabled: boolean = true) {
  const fetchCount = useTeamUnreadStore((s) => s.fetch);

  useEffect(() => {
    if (!enabled) return;
    void fetchCount();
    const interval = setInterval(() => {
      void fetchCount();
    }, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void fetchCount();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [enabled, fetchCount]);
}

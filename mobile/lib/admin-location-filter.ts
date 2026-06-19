import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const STORAGE_KEY = "@ee/admin_location_filter_v1";

/**
 * The restaurant the admin section is currently scoped to. Shared across the
 * hub, approvals, and shifts screens so a manager picks their site once and it
 * sticks while they move between screens. `null` means "all restaurants".
 *
 * Persisted to AsyncStorage so a manager's chosen site survives a hard close —
 * they almost always work one restaurant and shouldn't have to re-pick it on
 * every launch. `hydrate()` loads the saved value once on first mount.
 */
interface AdminLocationFilterState {
  selected: string | null;
  hydrated: boolean;
  setSelected: (location: string | null) => void;
  hydrate: () => Promise<void>;
}

export const useAdminLocationFilter = create<AdminLocationFilterState>(
  (set, get) => ({
    selected: null,
    hydrated: false,

    setSelected: (selected) => {
      set({ selected });
      // Best-effort persistence — `null` clears the key so "All restaurants"
      // is the saved state, not a stale value.
      void (selected === null
        ? AsyncStorage.removeItem(STORAGE_KEY)
        : AsyncStorage.setItem(STORAGE_KEY, selected)
      ).catch(() => {});
    },

    hydrate: async () => {
      if (get().hydrated) return;
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        // Don't clobber a choice the manager made before hydration resolved.
        set((state) =>
          state.selected === null && saved !== null
            ? { selected: saved, hydrated: true }
            : { hydrated: true }
        );
      } catch {
        set({ hydrated: true });
      }
    },
  })
);

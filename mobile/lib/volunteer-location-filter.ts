import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const FILTER_KEY = "@ee/volunteer_location_filter_v1";

/**
 * The location the volunteer shifts tab is filtered to. `null` means
 * "All locations". Until the volunteer explicitly picks (hasChosen), the
 * profile's default location applies instead.
 *
 * Persisted to AsyncStorage so a switch survives app restarts - previously the
 * filter reset to the profile default on every launch, which made hopping
 * between restaurants tedious for anyone volunteering at more than one.
 */
interface VolunteerLocationFilterState {
  selected: string | null;
  /** True once the volunteer explicitly picked (including "All locations"). */
  hasChosen: boolean;
  hydrated: boolean;
  setSelected: (location: string | null) => void;
  hydrate: () => Promise<void>;
}

export const useVolunteerLocationFilter = create<VolunteerLocationFilterState>(
  (set, get) => ({
    selected: null,
    hasChosen: false,
    hydrated: false,

    setSelected: (selected) => {
      set({ selected, hasChosen: true });
      // Best-effort persistence; JSON wrapper keeps "All locations" (null)
      // distinguishable from "never chosen" (missing key).
      void AsyncStorage.setItem(FILTER_KEY, JSON.stringify({ selected })).catch(
        () => {}
      );
    },

    hydrate: async () => {
      if (get().hydrated) return;
      try {
        const saved = await AsyncStorage.getItem(FILTER_KEY);
        const parsed = saved
          ? (JSON.parse(saved) as { selected?: string | null })
          : null;
        // Don't clobber a choice made before hydration resolved.
        set((state) => ({
          hydrated: true,
          ...(!state.hasChosen && parsed
            ? { selected: parsed.selected ?? null, hasChosen: true }
            : {}),
        }));
      } catch {
        set({ hydrated: true });
      }
    },
  })
);

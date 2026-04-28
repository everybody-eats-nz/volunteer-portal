import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const ONBOARDING_STORAGE_KEY = '@ee/onboarding_completed_v1';

type OnboardingState = {
  visible: boolean;
  hasChecked: boolean;
  checkInitial: () => Promise<void>;
  show: () => void;
  hide: () => void;
  markComplete: () => Promise<void>;
};

export const useOnboarding = create<OnboardingState>((set) => ({
  visible: false,
  hasChecked: false,

  checkInitial: async () => {
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
      set({ visible: raw !== 'true', hasChecked: true });
    } catch {
      set({ visible: true, hasChecked: true });
    }
  },

  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),

  markComplete: async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      // Best-effort — if storage fails the user sees the flow again, which
      // is annoying but not broken.
    }
    set({ visible: false });
  },
}));

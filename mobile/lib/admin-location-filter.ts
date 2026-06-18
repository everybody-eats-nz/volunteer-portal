import { create } from "zustand";

/**
 * The restaurant the admin section is currently scoped to. Shared across the
 * hub, approvals, and shifts screens so a manager picks their site once and it
 * sticks while they move between screens. `null` means "all restaurants".
 *
 * In-memory only — the filter resets to all on a fresh launch, which is the
 * safe default (you always see everything until you narrow it down).
 */
interface AdminLocationFilterState {
  selected: string | null;
  setSelected: (location: string | null) => void;
}

export const useAdminLocationFilter = create<AdminLocationFilterState>(
  (set) => ({
    selected: null,
    setSelected: (selected) => set({ selected }),
  })
);

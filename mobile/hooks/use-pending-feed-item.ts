import { create } from 'zustand';

/**
 * One-shot handoff between deep-link routing and the home tab. When a
 * notification (push or in-app) targets a specific feed item, the routing
 * helper sets `pendingId` and navigates to the home tab. The home screen
 * watches this id and, once the feed contains a matching item, opens that
 * item's sheet and clears the id.
 */
type PendingFeedItemState = {
  pendingId: string | null;
  setPendingId: (id: string) => void;
  clear: () => void;
};

export const usePendingFeedItemStore = create<PendingFeedItemState>((set) => ({
  pendingId: null,
  setPendingId: (id) => set({ pendingId: id }),
  clear: () => set({ pendingId: null }),
}));

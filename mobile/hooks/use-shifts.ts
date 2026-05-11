import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { api } from "@/lib/api";
import { syncShifts } from "@/lib/calendar-sync";
import type { Shift } from "@/lib/dummy-data";
import { queryKeys } from "@/lib/query-keys";

export type PeriodFriend = {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
  /** True for actual friends; false for users with PUBLIC profile visibility. */
  isFriend: boolean;
};

type ShiftsResponse = {
  myShifts: Shift[];
  available: Shift[];
  past: Shift[];
  pastNextCursor: string | null;
  userDefaultLocation: string | null;
  periodFriends: Record<string, PeriodFriend[]>;
  shiftFriends?: Record<string, PeriodFriend[]>;
};

type UseShiftsReturn = {
  myShifts: Shift[];
  available: Shift[];
  past: Shift[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMorePast: () => Promise<void>;
  hasMorePast: boolean;
  isLoadingMore: boolean;
  userDefaultLocation: string | null;
  /** Friends keyed by "YYYY-MM-DD-DAY" or "YYYY-MM-DD-EVE" */
  periodFriends: Record<string, PeriodFriend[]>;
  /** Friends keyed by shift ID — friends signed up for that specific role */
  shiftFriends: Record<string, PeriodFriend[]>;
};

export function useShifts(): UseShiftsReturn {
  const query = useInfiniteQuery({
    queryKey: queryKeys.shifts.list(),
    queryFn: ({ pageParam }) => {
      const path = pageParam
        ? `/api/mobile/shifts?pastCursor=${encodeURIComponent(pageParam)}`
        : "/api/mobile/shifts";
      return api<ShiftsResponse>(path);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pastNextCursor,
  });

  const firstPage = query.data?.pages[0];

  // First page carries myShifts/available/userDefaultLocation/periodFriends/shiftFriends;
  // later pages only extend `past`. Fold all `past` arrays into one list.
  const past = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.past),
    [query.data?.pages]
  );

  // Reconcile device calendar with fresh shift data on every successful first
  // page (picks up web signups and cancellations). No-op unless the user
  // opted in. Keyed on dataUpdatedAt so refetches re-sync.
  const myShifts = firstPage?.myShifts ?? [];
  const dataUpdatedAt = query.dataUpdatedAt;
  useEffect(() => {
    if (!firstPage) return;
    syncShifts(firstPage.myShifts).catch(() => {
      // Swallow: calendar sync is best-effort, never block the UI on it.
    });
  }, [firstPage, dataUpdatedAt]);

  return {
    myShifts,
    available: firstPage?.available ?? [],
    past,
    isLoading: query.isPending,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to load shifts"
      : null,
    refresh: async () => {
      await query.refetch();
    },
    loadMorePast: async () => {
      if (!query.hasNextPage || query.isFetchingNextPage) return;
      await query.fetchNextPage();
    },
    hasMorePast: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    userDefaultLocation: firstPage?.userDefaultLocation ?? null,
    periodFriends: firstPage?.periodFriends ?? {},
    shiftFriends: firstPage?.shiftFriends ?? {},
  };
}

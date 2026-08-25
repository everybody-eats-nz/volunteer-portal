import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { api } from "@/lib/api";
import { syncShifts } from "@/lib/calendar-sync";
import type { Shift } from "@/lib/dummy-data";
import { queryKeys } from "@/lib/query-keys";
import { normalizeSignupStatus, type SignupStatus } from "@/lib/signup-status";

export type PeriodFriend = {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
  /** True for actual friends; false for users with PUBLIC profile visibility. */
  isFriend: boolean;
  /** A PENDING volunteer has asked for the shift, not been given it. */
  status: SignupStatus;
};

/** Wire shape — older API builds omit `status`, so normalize before use. */
type FriendPayload = Omit<PeriodFriend, "status"> & { status?: string | null };

function normalizeFriendMap(
  map: Record<string, FriendPayload[]> | undefined
): Record<string, PeriodFriend[]> {
  if (!map) return {};
  return Object.fromEntries(
    Object.entries(map).map(([key, friends]) => [
      key,
      friends.map((friend) => ({
        ...friend,
        status: normalizeSignupStatus(friend.status),
      })),
    ])
  );
}

export type BrowsableLocation = {
  name: string;
  /** Recently launched restaurant - shows a subtle "New" badge in the picker. */
  isNew: boolean;
};

type ShiftsResponse = {
  myShifts: Shift[];
  available: Shift[];
  past: Shift[];
  pastNextCursor: string | null;
  userDefaultLocation: string | null;
  /** Locations with upcoming shifts (server-driven, includes "New" flags). */
  locations?: BrowsableLocation[];
  periodFriends: Record<string, FriendPayload[]>;
  shiftFriends?: Record<string, FriendPayload[]>;
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
  /** Locations volunteers can browse right now, with "New" launch flags. */
  browsableLocations: BrowsableLocation[];
  /** Friends keyed by "YYYY-MM-DD-DAY" or "YYYY-MM-DD-EVE" */
  periodFriends: Record<string, PeriodFriend[]>;
  /** Friends keyed by shift ID — friends signed up for that specific role */
  shiftFriends: Record<string, PeriodFriend[]>;
};

type UseHomeShiftsReturn = Pick<
  UseShiftsReturn,
  | "myShifts"
  | "available"
  | "isLoading"
  | "error"
  | "refresh"
  | "userDefaultLocation"
  | "periodFriends"
>;

/**
 * What the home tab needs, and nothing else: the user's upcoming shifts, a
 * rolling week of available shifts at their own restaurant, and the friends
 * on each of those sessions.
 *
 * Kept separate from {@link useShifts} on purpose. The full payload is the
 * Shifts tab's dataset — a quarter of shifts across every restaurant plus a
 * per-shift friend map — which runs to well over a megabyte of JSON at real
 * data volumes. Home renders a few dozen of those rows and discards the rest,
 * so it asks the server for the trimmed `scope=home` response instead.
 */
export function useHomeShifts(): UseHomeShiftsReturn {
  const query = useQuery({
    queryKey: queryKeys.shifts.home(),
    queryFn: () => api<ShiftsResponse>("/api/mobile/shifts?scope=home"),
  });

  const data = query.data;

  const periodFriends = useMemo(
    () => normalizeFriendMap(data?.periodFriends),
    [data?.periodFriends]
  );

  // Same device-calendar reconciliation as useShifts: `myShifts` is complete
  // in this scope (only `available` is windowed), so syncing from home is
  // correct. Both hooks reconcile to the same state, so whichever tab the
  // user opens first keeps the calendar current.
  const myShifts = data?.myShifts ?? [];
  const dataUpdatedAt = query.dataUpdatedAt;
  useEffect(() => {
    if (!data) return;
    syncShifts(data.myShifts).catch(() => {
      // Swallow: calendar sync is best-effort, never block the UI on it.
    });
  }, [data, dataUpdatedAt]);

  return {
    myShifts,
    available: data?.available ?? [],
    isLoading: query.isPending,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to load shifts"
      : null,
    refresh: async () => {
      await query.refetch();
    },
    userDefaultLocation: data?.userDefaultLocation ?? null,
    periodFriends,
  };
}

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

  const periodFriends = useMemo(
    () => normalizeFriendMap(firstPage?.periodFriends),
    [firstPage?.periodFriends]
  );
  const shiftFriends = useMemo(
    () => normalizeFriendMap(firstPage?.shiftFriends),
    [firstPage?.shiftFriends]
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
    browsableLocations: firstPage?.locations ?? [],
    periodFriends,
    shiftFriends,
  };
}

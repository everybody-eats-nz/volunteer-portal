import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { syncShifts } from "@/lib/calendar-sync";
import type { Shift } from "@/lib/dummy-data";

export type PeriodFriend = {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
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
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [available, setAvailable] = useState<Shift[]>([]);
  const [past, setPast] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userDefaultLocation, setUserDefaultLocation] = useState<string | null>(null);
  const [periodFriends, setPeriodFriends] = useState<Record<string, PeriodFriend[]>>({});
  const [shiftFriends, setShiftFriends] = useState<Record<string, PeriodFriend[]>>({});

  const pastCursorRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);

  const fetchShifts = useCallback(async () => {
    try {
      setError(null);
      const result = await api<ShiftsResponse>("/api/mobile/shifts");
      setMyShifts(result.myShifts);
      setAvailable(result.available);
      setPast(result.past);
      setUserDefaultLocation(result.userDefaultLocation ?? null);
      setPeriodFriends(result.periodFriends ?? {});
      setShiftFriends(result.shiftFriends ?? {});
      pastCursorRef.current = result.pastNextCursor;

      // Reconcile device calendar with fresh shift data (picks up web signups
      // and cancellations). No-op unless the user opted in.
      syncShifts(result.myShifts).catch(() => {
        // Swallow: calendar sync is best-effort, never block the UI on it.
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shifts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchShifts();
  }, [fetchShifts]);

  const loadMorePast = useCallback(async () => {
    if (!pastCursorRef.current || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({
        pastCursor: pastCursorRef.current,
      });
      const result = await api<ShiftsResponse>(
        `/api/mobile/shifts?${params}`
      );
      setPast((prev) => [...prev, ...result.past]);
      pastCursorRef.current = result.pastNextCursor;
    } catch {
      // Silently fail — user can retry by scrolling again
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, []);

  return {
    myShifts,
    available,
    past,
    isLoading,
    error,
    refresh,
    loadMorePast,
    hasMorePast: pastCursorRef.current !== null,
    isLoadingMore,
    userDefaultLocation,
    periodFriends,
    shiftFriends,
  };
}

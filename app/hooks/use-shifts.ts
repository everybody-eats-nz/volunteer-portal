import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import type { Shift } from "@/lib/dummy-data";

type ShiftsResponse = {
  myShifts: Shift[];
  available: Shift[];
  past: Shift[];
  availableNextCursor: string | null;
  pastNextCursor: string | null;
};

type UseShiftsReturn = {
  myShifts: Shift[];
  available: Shift[];
  past: Shift[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMoreAvailable: () => Promise<void>;
  loadMorePast: () => Promise<void>;
  hasMoreAvailable: boolean;
  hasMorePast: boolean;
  isLoadingMore: boolean;
};

export function useShifts(): UseShiftsReturn {
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [available, setAvailable] = useState<Shift[]>([]);
  const [past, setPast] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCursorRef = useRef<string | null>(null);
  const pastCursorRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);

  const fetchShifts = useCallback(async () => {
    try {
      setError(null);
      const result = await api<ShiftsResponse>("/api/mobile/shifts");
      setMyShifts(result.myShifts);
      setAvailable(result.available);
      setPast(result.past);
      availableCursorRef.current = result.availableNextCursor;
      pastCursorRef.current = result.pastNextCursor;
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

  const loadMoreAvailable = useCallback(async () => {
    if (!availableCursorRef.current || isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({
        availableCursor: availableCursorRef.current,
      });
      const result = await api<ShiftsResponse>(
        `/api/mobile/shifts?${params}`
      );
      setAvailable((prev) => [...prev, ...result.available]);
      availableCursorRef.current = result.availableNextCursor;
    } catch {
      // Silently fail — user can retry by scrolling again
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, []);

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
    loadMoreAvailable,
    loadMorePast,
    hasMoreAvailable: availableCursorRef.current !== null,
    hasMorePast: pastCursorRef.current !== null,
    isLoadingMore,
  };
}

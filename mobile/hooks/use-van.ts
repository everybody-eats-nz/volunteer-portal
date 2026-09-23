import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import {
  fetchDriveHome,
  fetchDriverState,
  fetchTrip,
  fetchTripHistory,
  fetchVan,
} from "@/lib/van";
import { queryKeys } from "@/lib/query-keys";

/**
 * Whether this person may take a van out.
 *
 * Driving is a capability, never a role — the answer comes from an APPROVED
 * `DriverProfile`, so a volunteer who also drives stays a volunteer. Every
 * signed-in user asks it at launch to decide whether the Drive tab exists.
 *
 * Five minutes rather than longer: the office can put a driver on hold or
 * remove them at any time, and bringing the app back to the foreground should
 * take the tab away soon after, not half an hour later. The answer is a few
 * bytes, so re-asking on foreground costs next to nothing.
 */
export function useDriverState(enabled = true) {
  return useQuery({
    queryKey: queryKeys.van.driver(),
    queryFn: fetchDriverState,
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Everything the Drive tab paints, plus the reference data the next screen needs. */
export function useDriveHome(enabled = true) {
  return useQuery({
    queryKey: queryKeys.van.home(),
    queryFn: fetchDriveHome,
    enabled,
  });
}

/**
 * One van. Only fetched on a cold start from the QR sticker's universal link —
 * the tab already carries the fleet, and this screen is seeded from it.
 */
export function useVan(vanId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.van.vehicle(vanId ?? ""),
    queryFn: () => fetchVan(vanId!),
    enabled: Boolean(vanId),
  });
}

export function useTrip(tripId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.van.trip(tripId ?? ""),
    queryFn: () => fetchTrip(tripId!),
    enabled: Boolean(tripId),
  });
}

/** The driver's own history, a page at a time. Never anybody else's. */
export function useTripHistory() {
  return useInfiniteQuery({
    queryKey: queryKeys.van.history(),
    queryFn: ({ pageParam }) => fetchTripHistory(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

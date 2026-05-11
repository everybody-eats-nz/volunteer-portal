import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Shift, ShiftSignup } from "@/lib/dummy-data";
import { queryKeys } from "@/lib/query-keys";

/** Raw shape returned by GET /api/mobile/shifts/[id] */
type ShiftDetailResponse = {
  id: string;
  shiftType: {
    id: string;
    name: string;
    description: string;
  };
  start: string;
  end: string;
  location: string;
  capacity: number;
  signedUp: number;
  status: "CONFIRMED" | "PENDING" | "WAITLISTED" | "REGULAR_PENDING" | null;
  notes: string | null;
  signups: {
    id: string;
    name: string;
    profilePhotoUrl: string | null;
    isFriend: boolean;
  }[];
};

/** Raw shape returned by GET /api/mobile/shifts/[id]/concurrent */
type ConcurrentResponse = {
  concurrentShifts: {
    id: string;
    shiftTypeName: string;
    shiftTypeDescription: string;
    spotsRemaining: number;
  }[];
  friends: {
    id: string;
    name: string;
    profilePhotoUrl: string | null;
    shiftTypeName: string | null;
    isFriend: boolean;
  }[];
};

export type PeriodFriend = {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
  /** The role/shift-type name the friend is signed up for */
  shiftTypeName: string | null;
  /** True for actual friends; false for users with PUBLIC profile visibility. */
  isFriend: boolean;
};

type UseShiftDetailReturn = {
  shift: Shift | null;
  signups: ShiftSignup[];
  /** Friends signed up for any shift at the same location/date/AM-PM, with their role */
  periodFriends: PeriodFriend[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useShiftDetail(shiftId: string | undefined): UseShiftDetailReturn {
  const enabled = Boolean(shiftId);

  const detail = useQuery({
    queryKey: shiftId ? queryKeys.shifts.detail(shiftId) : ["shifts", "detail", "noop"],
    queryFn: () => api<ShiftDetailResponse>(`/api/mobile/shifts/${shiftId}`),
    enabled,
  });

  // Concurrent friends/shifts is best-effort — render the detail even if it fails.
  const concurrent = useQuery({
    queryKey: shiftId
      ? queryKeys.shifts.concurrent(shiftId)
      : ["shifts", "concurrent", "noop"],
    queryFn: () =>
      api<ConcurrentResponse>(`/api/mobile/shifts/${shiftId}/concurrent`),
    enabled,
    retry: false,
  });

  const data = detail.data;
  const shift: Shift | null = data
    ? {
        id: data.id,
        shiftType: {
          id: data.shiftType.id,
          name: data.shiftType.name,
          description: data.shiftType.description,
        },
        start: data.start,
        end: data.end,
        location: data.location,
        capacity: data.capacity,
        signedUp: data.signedUp,
        status: data.status === "REGULAR_PENDING" ? "PENDING" : data.status,
        notes: data.notes ?? undefined,
      }
    : null;

  const signups: ShiftSignup[] = (data?.signups ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    profilePhotoUrl: s.profilePhotoUrl ?? undefined,
    isFriend: s.isFriend,
  }));

  const periodFriends: PeriodFriend[] = (concurrent.data?.friends ?? []).map(
    (f) => ({
      id: f.id,
      name: f.name,
      profilePhotoUrl: f.profilePhotoUrl,
      shiftTypeName: f.shiftTypeName,
      isFriend: f.isFriend ?? true,
    })
  );

  return {
    shift,
    signups,
    periodFriends,
    isLoading: enabled ? detail.isPending : false,
    error: detail.error
      ? detail.error instanceof Error
        ? detail.error.message
        : "Failed to load shift details"
      : null,
    refresh: async () => {
      await Promise.all([detail.refetch(), concurrent.refetch()]);
    },
  };
}

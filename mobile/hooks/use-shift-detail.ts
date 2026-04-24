import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Shift, ShiftSignup } from "@/lib/dummy-data";

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
  }[];
};

export type PeriodFriend = {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
  /** The role/shift-type name the friend is signed up for */
  shiftTypeName: string | null;
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
  const [shift, setShift] = useState<Shift | null>(null);
  const [signups, setSignups] = useState<ShiftSignup[]>([]);
  const [periodFriends, setPeriodFriends] = useState<PeriodFriend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!shiftId) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const [data, concurrent] = await Promise.all([
        api<ShiftDetailResponse>(`/api/mobile/shifts/${shiftId}`),
        api<ConcurrentResponse>(`/api/mobile/shifts/${shiftId}/concurrent`).catch(
          () => null,
        ),
      ]);

      const mappedShift: Shift = {
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
      };

      const mappedSignups: ShiftSignup[] = data.signups.map((s) => ({
        id: s.id,
        name: s.name,
        profilePhotoUrl: s.profilePhotoUrl ?? undefined,
        isFriend: s.isFriend,
      }));

      const mappedPeriodFriends: PeriodFriend[] = (concurrent?.friends ?? []).map(
        (f) => ({
          id: f.id,
          name: f.name,
          profilePhotoUrl: f.profilePhotoUrl,
          shiftTypeName: f.shiftTypeName,
        }),
      );

      setShift(mappedShift);
      setSignups(mappedSignups);
      setPeriodFriends(mappedPeriodFriends);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load shift details"
      );
    } finally {
      setIsLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchDetail();
  }, [fetchDetail]);

  return {
    shift,
    signups,
    periodFriends,
    isLoading,
    error,
    refresh,
  };
}

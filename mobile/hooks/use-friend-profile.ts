import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

export type FriendProfile = {
  id: string;
  name: string;
  profilePhotoUrl?: string;
  grade: "GREEN" | "YELLOW" | "PINK";
  shiftsTogether: number;
  mutualFriends: number;
  friendsSince: string;
  totalShifts: number;
  hoursVolunteered: number;
  shiftsThisMonth: number;
  avgPerMonth: number;
  favoriteRole: string;
  favoriteRoleCount: number;
  sharedShifts: Array<{
    id: string;
    type: string;
    date: string;
    location: string;
    isUpcoming: boolean;
  }>;
  upcomingShifts: Array<{
    id: string;
    type: string;
    date: string;
    time: string;
    location: string;
  }>;
};

type FriendProfileResponse = {
  profile: FriendProfile;
};

type UseFriendProfileReturn = {
  profile: FriendProfile | null;
  isLoading: boolean;
  error: string | null;
};

export function useFriendProfile(friendId: string): UseFriendProfileReturn {
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      const result = await api<FriendProfileResponse>(
        `/api/mobile/friends/${friendId}`
      );
      setProfile(result.profile);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load friend profile"
      );
    } finally {
      setIsLoading(false);
    }
  }, [friendId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, isLoading, error };
}

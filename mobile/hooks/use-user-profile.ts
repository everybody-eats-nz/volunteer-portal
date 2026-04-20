import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

export type UserFriendshipStatus =
  | "SELF"
  | "FRIENDS"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "NONE";

export type UserProfile = {
  id: string;
  name: string;
  firstName: string;
  profilePhotoUrl?: string;
  grade: "GREEN" | "YELLOW" | "PINK";
  totalShifts: number;
  hoursVolunteered: number;
  friendshipStatus: UserFriendshipStatus;
  friendRequestId: string | null;
  allowFriendRequests: boolean;
  isBlocked: boolean;
  hasReported: boolean;
  isSelf: boolean;
};

type UserProfileResponse = { profile: UserProfile };

type UseUserProfileReturn = {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setProfile: (updater: (prev: UserProfile | null) => UserProfile | null) => void;
};

export function useUserProfile(userId: string): UseUserProfileReturn {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setError(null);
      const result = await api<UserProfileResponse>(
        `/api/mobile/users/${encodeURIComponent(userId)}`
      );
      setProfileState(result.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchProfile();
  }, [fetchProfile]);

  const setProfile = useCallback(
    (updater: (prev: UserProfile | null) => UserProfile | null) => {
      setProfileState((prev) => updater(prev));
    },
    []
  );

  return { profile, isLoading, error, refresh, setProfile };
}

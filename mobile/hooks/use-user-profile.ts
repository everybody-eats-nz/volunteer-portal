import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type UserFriendshipStatus =
  | "SELF"
  | "FRIENDS"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "NONE";

/**
 * Rich connection data only present when the viewer is FRIENDS with the
 * target. Mirrors the data the (now-removed) /api/mobile/friends/[id]
 * endpoint used to return.
 */
export type UserConnection = {
  friendsSince: string;
  shiftsTogether: number;
  mutualFriends: number;
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
  /** Populated only when friendshipStatus === "FRIENDS" */
  connection: UserConnection | null;
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
  const queryClient = useQueryClient();
  const queryKey = queryKeys.profile.user(userId);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      api<UserProfileResponse>(
        `/api/mobile/users/${encodeURIComponent(userId)}`
      ),
    select: (data) => data.profile,
    enabled: Boolean(userId),
  });

  const setProfile = useCallback(
    (updater: (prev: UserProfile | null) => UserProfile | null) => {
      queryClient.setQueryData<UserProfileResponse>(queryKey, (prev) => {
        const next = updater(prev?.profile ?? null);
        if (!next) return prev;
        return { profile: next };
      });
    },
    [queryClient, queryKey]
  );

  return {
    profile: query.data ?? null,
    isLoading: query.isPending,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to load profile"
      : null,
    refresh: async () => {
      await query.refetch();
    },
    setProfile,
  };
}

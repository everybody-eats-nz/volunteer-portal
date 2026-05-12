import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

/**
 * Suggested friend payload returned by GET /api/mobile/friends/recommended.
 * Mirrors the web `RecommendedFriend` shape.
 */
export type RecommendedFriend = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  sharedShiftsCount: number;
  recentSharedShifts: Array<{
    id: string;
    start: string;
    shiftTypeName: string;
    location: string | null;
  }>;
  isPendingRequest?: boolean;
  requestId?: string;
};

type RecommendedResponse = {
  recommendedFriends: RecommendedFriend[];
};

type UseRecommendedFriendsReturn = {
  recommended: RecommendedFriend[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sendRequest: (toUserId: string) => Promise<void>;
  isSending: (toUserId: string) => boolean;
  acceptRequest: (requestId: string, fromUserId: string) => Promise<void>;
  isAccepting: (fromUserId: string) => boolean;
};

export function useRecommendedFriends(): UseRecommendedFriendsReturn {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.friends.recommended(),
    queryFn: () =>
      api<RecommendedResponse>("/api/mobile/friends/recommended"),
    select: (data) => data.recommendedFriends,
  });

  const removeSuggestion = (userId: string) => {
    queryClient.setQueryData<RecommendedResponse>(
      queryKeys.friends.recommended(),
      (prev) =>
        prev
          ? {
              recommendedFriends: prev.recommendedFriends.filter(
                (f) => f.id !== userId
              ),
            }
          : prev
    );
  };

  const sendMutation = useMutation({
    mutationFn: (toUserId: string) =>
      api<{ ok: true; requestId: string }>("/api/mobile/friends/requests", {
        method: "POST",
        body: { toUserId },
      }),
    onSuccess: (_, toUserId) => {
      removeSuggestion(toUserId);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: ({ requestId }: { requestId: string; fromUserId: string }) =>
      api<{ ok: true; status: string }>(
        `/api/mobile/friends/requests/${requestId}/accept`,
        { method: "POST" }
      ),
    onSuccess: (_, { fromUserId }) => {
      removeSuggestion(fromUserId);
      // New friendship — refresh the existing friends list too.
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.list() });
    },
  });

  return {
    recommended: query.data ?? [],
    isLoading: query.isPending,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to load suggestions"
      : null,
    refresh: async () => {
      await query.refetch();
    },
    sendRequest: async (toUserId: string) => {
      await sendMutation.mutateAsync(toUserId);
    },
    isSending: (toUserId: string) =>
      sendMutation.isPending && sendMutation.variables === toUserId,
    acceptRequest: async (requestId: string, fromUserId: string) => {
      await acceptMutation.mutateAsync({ requestId, fromUserId });
    },
    isAccepting: (fromUserId: string) =>
      acceptMutation.isPending &&
      acceptMutation.variables?.fromUserId === fromUserId,
  };
}

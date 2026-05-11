import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Friend } from "@/lib/dummy-data";
import { queryKeys } from "@/lib/query-keys";

type FriendsResponse = {
  friends: Friend[];
};

type UseFriendsReturn = {
  friends: Friend[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useFriends(): UseFriendsReturn {
  const query = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendsResponse>("/api/mobile/friends"),
    select: (data) => data.friends,
  });

  return {
    friends: query.data ?? [],
    isLoading: query.isPending,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to load friends"
      : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Friend } from "@/lib/dummy-data";

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
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    try {
      setError(null);
      const result = await api<FriendsResponse>("/api/mobile/friends");
      setFriends(result.friends);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load friends");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchFriends();
  }, [fetchFriends]);

  return {
    friends,
    isLoading,
    error,
    refresh,
  };
}

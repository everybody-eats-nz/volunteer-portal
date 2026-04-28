import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { FeedItem } from "@/lib/dummy-data";

type FeedResponse = {
  items: FeedItem[];
};

type UseFeedReturn = {
  items: FeedItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Update a single item's interaction counts in-place (used by useFeedInteractions) */
  updateItem: (
    id: string,
    patch: Partial<Pick<FeedItem, "likeCount" | "likedByMe" | "commentCount">>
  ) => void;
  /** Instantly remove all feed items authored by a given user (after blocking). */
  removeItemsByUser: (userId: string) => void;
};

export function useFeed(): UseFeedReturn {
  const [realItems, setRealItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    try {
      setError(null);
      const result = await api<FeedResponse>("/api/mobile/feed");
      setRealItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
      setRealItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchFeed();
  }, [fetchFeed]);

  const updateItem = useCallback(
    (
      id: string,
      patch: Partial<Pick<FeedItem, "likeCount" | "likedByMe" | "commentCount">>
    ) => {
      setRealItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const [locallyBlockedUserIds, setLocallyBlockedUserIds] = useState<
    Set<string>
  >(new Set());

  const removeItemsByUser = useCallback((userId: string) => {
    setLocallyBlockedUserIds((prev) => new Set(prev).add(userId));
  }, []);

  const hasAuthor = (item: FeedItem): item is FeedItem & { userId?: string } =>
    item.type === "achievement" ||
    item.type === "milestone" ||
    item.type === "friend_signup" ||
    item.type === "photo_post";

  const items = realItems
    .filter((item) => {
      if (!hasAuthor(item)) return true;
      const uid = (item as { userId?: string }).userId;
      return !uid || !locallyBlockedUserIds.has(uid);
    })
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  return { items, isLoading, error, refresh, updateItem, removeItemsByUser };
}

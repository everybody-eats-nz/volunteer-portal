import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import {
  FEED_ITEMS as DUMMY_PHOTO_POSTS,
  type FeedItem,
} from "@/lib/dummy-data";

/** Photo posts are the only items without a real data source. */
const DUMMY_ONLY_ITEMS = DUMMY_PHOTO_POSTS.filter(
  (item) => item.type === "photo_post"
);

type FeedResponse = {
  items: FeedItem[];
};

type UseFeedReturn = {
  items: FeedItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Update a single item's interaction counts in-place (used by useFeedInteractions) */
  updateItem: (id: string, patch: Partial<Pick<FeedItem, "likeCount" | "likedByMe" | "commentCount">>) => void;
  /** Instantly remove all feed items authored by a given user (after blocking). */
  removeItemsByUser: (userId: string) => void;
};

/**
 * Fetches real feed data from the API and merges it with
 * dummy photo posts (which don't have a real data source yet).
 *
 * The API now populates likeCount, likedByMe, recentLikers, commentCount
 * on every item, so all interaction data comes from the DB.
 */
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
    (id: string, patch: Partial<Pick<FeedItem, "likeCount" | "likedByMe" | "commentCount">>) => {
      setRealItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...patch } : item
        )
      );
    },
    []
  );

  const [locallyBlockedUserIds, setLocallyBlockedUserIds] = useState<Set<string>>(
    new Set()
  );

  const removeItemsByUser = useCallback((userId: string) => {
    setLocallyBlockedUserIds((prev) => new Set(prev).add(userId));
  }, []);

  const hasAuthor = (item: FeedItem): item is FeedItem & { userId?: string } =>
    item.type === "achievement" ||
    item.type === "milestone" ||
    item.type === "friend_signup" ||
    item.type === "photo_post";

  // Merge real items with dummy photo posts, filter out blocked authors, sort by timestamp desc.
  // Note: photo posts also go through the real interaction system (their IDs are stable).
  const items = [...realItems, ...DUMMY_ONLY_ITEMS]
    .filter((item) => {
      if (!hasAuthor(item)) return true;
      const uid = (item as { userId?: string }).userId;
      return !uid || !locallyBlockedUserIds.has(uid);
    })
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  return { items, isLoading, error, refresh, updateItem, removeItemsByUser };
}

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import {
  FEED_ITEMS as DUMMY_FEED_ITEMS,
  type FeedItem,
} from "@/lib/dummy-data";

/** Feed items that have no real data source yet — announcements and photo posts */
const DUMMY_ONLY_ITEMS = DUMMY_FEED_ITEMS.filter(
  (item) => item.type === "announcement" || item.type === "photo_post"
);

type FeedResponse = {
  items: FeedItem[];
};

type UseFeedReturn = {
  items: FeedItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Fetches real feed data from the API and merges it with
 * dummy items (announcements, photo posts) that don't have
 * a real data source yet.
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
      // On error, fall back to empty real items — dummy items still show
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

  // Merge real items with dummy-only items, sorted by timestamp descending
  const items = [...realItems, ...DUMMY_ONLY_ITEMS].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return { items, isLoading, error, refresh };
}

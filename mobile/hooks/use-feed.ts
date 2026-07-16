import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { api } from "@/lib/api";
import type { FeedItem } from "@/lib/dummy-data";
import { rankFeedItems } from "@/lib/feed-ranking";
import { queryKeys } from "@/lib/query-keys";

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

const hasAuthor = (item: FeedItem): item is FeedItem & { userId?: string } =>
  item.type === "achievement" ||
  item.type === "friend_signup" ||
  item.type === "photo_post";

export function useFeed(): UseFeedReturn {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.feed.list();

  const query = useQuery({
    queryKey,
    queryFn: () => api<FeedResponse>("/api/mobile/feed"),
  });

  const updateItem = useCallback(
    (
      id: string,
      patch: Partial<Pick<FeedItem, "likeCount" | "likedByMe" | "commentCount">>
    ) => {
      queryClient.setQueryData<FeedResponse>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === id ? { ...item, ...patch } : item
          ),
        };
      });
    },
    [queryClient, queryKey]
  );

  const removeItemsByUser = useCallback(
    (userId: string) => {
      queryClient.setQueryData<FeedResponse>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.filter((item) => {
            if (!hasAuthor(item)) return true;
            const uid = (item as { userId?: string }).userId;
            return !uid || uid !== userId;
          }),
        };
      });
    },
    [queryClient, queryKey]
  );

  // Ordering: hype-adjusted recency — upcoming events and menus climb the
  // feed as their date approaches. See lib/feed-ranking.ts for the rationale.
  const items = useMemo(
    () => rankFeedItems(query.data?.items ?? []),
    [query.data?.items]
  );

  return {
    items,
    isLoading: query.isPending,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to load feed"
      : null,
    refresh: async () => {
      await query.refetch();
    },
    updateItem,
    removeItemsByUser,
  };
}

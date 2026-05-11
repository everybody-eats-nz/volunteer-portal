import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { api } from "@/lib/api";
import type { FeedComment } from "@/lib/dummy-data";
import { queryKeys } from "@/lib/query-keys";

type LikeResponse = {
  liked: boolean;
  likeCount: number;
};

type CommentsResponse = {
  comments: FeedComment[];
};

type AddCommentResponse = {
  comment: FeedComment;
};

type CommentState = {
  comments: FeedComment[];
  isLoading: boolean;
  error: string | null;
};

type ReportResponse = { ok: boolean };
type BlockResponse = { ok: boolean; blocked: boolean };
type EditCommentResponse = { comment: FeedComment };
type DeleteCommentResponse = { ok: boolean };

type UseFeedInteractionsReturn = {
  /** Toggle like on a feed item. Returns the new liked state and count. */
  toggleLike: (itemId: string) => Promise<LikeResponse | null>;

  /** Add a comment to a feed item. Returns the new comment. */
  addComment: (itemId: string, text: string, currentUserId: string, currentUserName: string, currentUserPhoto?: string) => Promise<FeedComment | null>;

  /** Edit the text of an existing comment you authored. Optimistic update. */
  editComment: (itemId: string, commentId: string, text: string) => Promise<FeedComment | null>;

  /** Delete a comment you authored. Optimistic removal. */
  deleteComment: (itemId: string, commentId: string) => Promise<boolean>;

  /** Report a feed item as objectionable content. */
  reportItem: (targetType: string, targetId: string, reason: string) => Promise<boolean>;

  /** Returns true if the user has already reported this targetId in this session. */
  hasReported: (targetId: string) => boolean;

  /** Block a user. Their content is removed from feed/comments server-side and notifies the admin. */
  blockUser: (userId: string) => Promise<boolean>;

  /** Returns true if the user has blocked this userId in this session. */
  hasBlocked: (userId: string) => boolean;

  /** Remove all cached comments from a blocked user (instant feed/comment cleanup). */
  removeCommentsByUser: (userId: string) => void;
};

/**
 * Subscribe to a single item's comments. The sheet calls this once with the
 * open item id; the cache survives the sheet closing, so re-opening the same
 * item shows comments instantly while a background revalidation runs.
 */
export function useFeedComments(itemId: string | null | undefined): CommentState {
  const query = useQuery({
    queryKey: itemId ? queryKeys.feedComments.forItem(itemId) : queryKeys.feedComments.all,
    queryFn: () =>
      api<CommentsResponse>(
        `/api/mobile/feed/${encodeURIComponent(itemId ?? "")}/comments`
      ).then((r) => r.comments),
    enabled: Boolean(itemId),
  });
  return {
    comments: query.data ?? [],
    isLoading: query.isPending && Boolean(itemId),
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to load comments"
      : null,
  };
}

/**
 * Manages mutations on feed items: likes, comments (add/edit/delete),
 * reports, and blocks. Comment lists themselves live in the React Query
 * cache — read them via {@link useFeedComments}.
 *
 * Likes: optimistic toggle done by the caller against the feed item.
 * Comments: optimistic patches against the per-item comments cache.
 */
export function useFeedInteractions(): UseFeedInteractionsReturn {
  const queryClient = useQueryClient();

  // Track items reported this session so the UI can reflect the reported state
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  // Track users blocked this session for instant UI feedback
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  const patchComments = useCallback(
    (itemId: string, updater: (prev: FeedComment[]) => FeedComment[]) => {
      const key = queryKeys.feedComments.forItem(itemId);
      queryClient.setQueryData<FeedComment[]>(key, (prev) => updater(prev ?? []));
    },
    [queryClient]
  );

  const toggleLike = useCallback(
    async (itemId: string): Promise<LikeResponse | null> => {
      try {
        const result = await api<LikeResponse>(
          `/api/mobile/feed/${encodeURIComponent(itemId)}/like`,
          { method: "POST" }
        );
        return result;
      } catch {
        return null;
      }
    },
    []
  );

  const addComment = useCallback(
    async (
      itemId: string,
      text: string,
      currentUserId: string,
      currentUserName: string,
      currentUserPhoto?: string
    ): Promise<FeedComment | null> => {
      const optimistic: FeedComment = {
        id: `optimistic-${Date.now()}`,
        userId: currentUserId,
        userName: currentUserName,
        profilePhotoUrl: currentUserPhoto,
        text,
        timestamp: new Date().toISOString(),
      };

      patchComments(itemId, (prev) => [...prev, optimistic]);

      try {
        const result = await api<AddCommentResponse>(
          `/api/mobile/feed/${encodeURIComponent(itemId)}/comments`,
          { method: "POST", body: { text } }
        );
        patchComments(itemId, (prev) =>
          prev.map((c) => (c.id === optimistic.id ? result.comment : c))
        );
        return result.comment;
      } catch {
        patchComments(itemId, (prev) =>
          prev.filter((c) => c.id !== optimistic.id)
        );
        return null;
      }
    },
    [patchComments]
  );

  const editComment = useCallback(
    async (
      itemId: string,
      commentId: string,
      text: string
    ): Promise<FeedComment | null> => {
      const key = queryKeys.feedComments.forItem(itemId);
      const previous = queryClient
        .getQueryData<FeedComment[]>(key)
        ?.find((c) => c.id === commentId);

      patchComments(itemId, (prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, text } : c))
      );

      try {
        const result = await api<EditCommentResponse>(
          `/api/mobile/feed/comments/${encodeURIComponent(commentId)}`,
          { method: "PATCH", body: { text } }
        );
        patchComments(itemId, (prev) =>
          prev.map((c) => (c.id === commentId ? result.comment : c))
        );
        return result.comment;
      } catch {
        if (previous) {
          patchComments(itemId, (prev) =>
            prev.map((c) => (c.id === commentId ? previous : c))
          );
        }
        return null;
      }
    },
    [patchComments, queryClient]
  );

  const deleteComment = useCallback(
    async (itemId: string, commentId: string): Promise<boolean> => {
      const key = queryKeys.feedComments.forItem(itemId);
      const snapshot = queryClient.getQueryData<FeedComment[]>(key) ?? [];
      const removedIndex = snapshot.findIndex((c) => c.id === commentId);
      const removed = snapshot[removedIndex];

      patchComments(itemId, (prev) => prev.filter((c) => c.id !== commentId));

      try {
        await api<DeleteCommentResponse>(
          `/api/mobile/feed/comments/${encodeURIComponent(commentId)}`,
          { method: "DELETE" }
        );
        return true;
      } catch {
        if (removed && removedIndex >= 0) {
          patchComments(itemId, (prev) => {
            const next = [...prev];
            next.splice(removedIndex, 0, removed);
            return next;
          });
        }
        return false;
      }
    },
    [patchComments, queryClient]
  );

  const reportItem = useCallback(
    async (targetType: string, targetId: string, reason: string): Promise<boolean> => {
      try {
        await api<ReportResponse>("/api/mobile/report", {
          method: "POST",
          body: { targetType, targetId, reason },
        });
        setReportedIds((prev) => new Set(prev).add(targetId));
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const hasReported = useCallback(
    (targetId: string) => reportedIds.has(targetId),
    [reportedIds]
  );

  const blockUser = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        await api<BlockResponse>(
          `/api/mobile/users/${encodeURIComponent(userId)}/block`,
          { method: "POST" }
        );
        setBlockedUserIds((prev) => new Set(prev).add(userId));
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const hasBlocked = useCallback(
    (userId: string) => blockedUserIds.has(userId),
    [blockedUserIds]
  );

  // After a block, scrub the blocked user's comments from every cached
  // per-item list so the feed/comment sheet updates instantly.
  const removeCommentsByUser = useCallback(
    (userId: string) => {
      const cache = queryClient.getQueryCache();
      const matches = cache.findAll({ queryKey: queryKeys.feedComments.all });
      for (const entry of matches) {
        const data = entry.state.data as FeedComment[] | undefined;
        if (!data) continue;
        queryClient.setQueryData<FeedComment[]>(
          entry.queryKey,
          data.filter((c) => c.userId !== userId)
        );
      }
    },
    [queryClient]
  );

  return {
    toggleLike,
    addComment,
    editComment,
    deleteComment,
    reportItem,
    hasReported,
    blockUser,
    hasBlocked,
    removeCommentsByUser,
  };
}

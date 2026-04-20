import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { FeedComment } from "@/lib/dummy-data";

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

  /** Load all comments for a feed item (call when the sheet opens). */
  loadComments: (itemId: string) => Promise<void>;

  /** Add a comment to a feed item. Returns the new comment. */
  addComment: (itemId: string, text: string, currentUserId: string, currentUserName: string, currentUserPhoto?: string) => Promise<FeedComment | null>;

  /** Edit the text of an existing comment you authored. Optimistic update. */
  editComment: (itemId: string, commentId: string, text: string) => Promise<FeedComment | null>;

  /** Delete a comment you authored. Optimistic removal. */
  deleteComment: (itemId: string, commentId: string) => Promise<boolean>;

  /** Get cached comment state for an item. */
  getCommentState: (itemId: string) => CommentState;

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
 * Manages real-time like/comment interactions on feed items.
 *
 * Likes: optimistic toggle — updates local state immediately, then calls API.
 * Comments: loaded lazily when the sheet opens, then appended optimistically on add.
 */
export function useFeedInteractions(): UseFeedInteractionsReturn {
  // Map of itemId → comment state
  const [commentStates, setCommentStates] = useState<
    Record<string, CommentState>
  >({});

  // Track items reported this session so the UI can reflect the reported state
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  // Track users blocked this session for instant UI feedback
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

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

  const loadComments = useCallback(async (itemId: string) => {
    // Skip if already loaded
    const existing = commentStates[itemId];
    if (existing?.comments.length > 0) return;

    setCommentStates((prev) => ({
      ...prev,
      [itemId]: { comments: [], isLoading: true, error: null },
    }));

    try {
      const result = await api<CommentsResponse>(
        `/api/mobile/feed/${encodeURIComponent(itemId)}/comments`
      );
      setCommentStates((prev) => ({
        ...prev,
        [itemId]: { comments: result.comments, isLoading: false, error: null },
      }));
    } catch (err) {
      setCommentStates((prev) => ({
        ...prev,
        [itemId]: {
          comments: [],
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to load comments",
        },
      }));
    }
  }, [commentStates]);

  const addComment = useCallback(
    async (
      itemId: string,
      text: string,
      currentUserId: string,
      currentUserName: string,
      currentUserPhoto?: string
    ): Promise<FeedComment | null> => {
      // Optimistic comment
      const optimistic: FeedComment = {
        id: `optimistic-${Date.now()}`,
        userId: currentUserId,
        userName: currentUserName,
        profilePhotoUrl: currentUserPhoto,
        text,
        timestamp: new Date().toISOString(),
      };

      setCommentStates((prev) => {
        const existing = prev[itemId] ?? { comments: [], isLoading: false, error: null };
        return {
          ...prev,
          [itemId]: {
            ...existing,
            comments: [...existing.comments, optimistic],
          },
        };
      });

      try {
        const result = await api<AddCommentResponse>(
          `/api/mobile/feed/${encodeURIComponent(itemId)}/comments`,
          { method: "POST", body: { text } }
        );

        // Replace optimistic with real comment
        setCommentStates((prev) => {
          const existing = prev[itemId] ?? { comments: [], isLoading: false, error: null };
          return {
            ...prev,
            [itemId]: {
              ...existing,
              comments: existing.comments.map((c) =>
                c.id === optimistic.id ? result.comment : c
              ),
            },
          };
        });

        return result.comment;
      } catch {
        // Remove optimistic comment on failure
        setCommentStates((prev) => {
          const existing = prev[itemId] ?? { comments: [], isLoading: false, error: null };
          return {
            ...prev,
            [itemId]: {
              ...existing,
              comments: existing.comments.filter((c) => c.id !== optimistic.id),
            },
          };
        });
        return null;
      }
    },
    []
  );

  const editComment = useCallback(
    async (
      itemId: string,
      commentId: string,
      text: string
    ): Promise<FeedComment | null> => {
      // Snapshot the previous comment so we can revert on failure
      let previous: FeedComment | undefined;
      setCommentStates((prev) => {
        const existing = prev[itemId];
        if (!existing) return prev;
        previous = existing.comments.find((c) => c.id === commentId);
        return {
          ...prev,
          [itemId]: {
            ...existing,
            comments: existing.comments.map((c) =>
              c.id === commentId ? { ...c, text } : c
            ),
          },
        };
      });

      try {
        const result = await api<EditCommentResponse>(
          `/api/mobile/feed/comments/${encodeURIComponent(commentId)}`,
          { method: "PATCH", body: { text } }
        );
        setCommentStates((prev) => {
          const existing = prev[itemId];
          if (!existing) return prev;
          return {
            ...prev,
            [itemId]: {
              ...existing,
              comments: existing.comments.map((c) =>
                c.id === commentId ? result.comment : c
              ),
            },
          };
        });
        return result.comment;
      } catch {
        // Revert optimistic edit
        setCommentStates((prev) => {
          const existing = prev[itemId];
          if (!existing || !previous) return prev;
          return {
            ...prev,
            [itemId]: {
              ...existing,
              comments: existing.comments.map((c) =>
                c.id === commentId ? (previous as FeedComment) : c
              ),
            },
          };
        });
        return null;
      }
    },
    []
  );

  const deleteComment = useCallback(
    async (itemId: string, commentId: string): Promise<boolean> => {
      let removed: FeedComment | undefined;
      let removedIndex = -1;
      setCommentStates((prev) => {
        const existing = prev[itemId];
        if (!existing) return prev;
        removedIndex = existing.comments.findIndex((c) => c.id === commentId);
        removed = existing.comments[removedIndex];
        return {
          ...prev,
          [itemId]: {
            ...existing,
            comments: existing.comments.filter((c) => c.id !== commentId),
          },
        };
      });

      try {
        await api<DeleteCommentResponse>(
          `/api/mobile/feed/comments/${encodeURIComponent(commentId)}`,
          { method: "DELETE" }
        );
        return true;
      } catch {
        // Revert by re-inserting at the original position
        setCommentStates((prev) => {
          const existing = prev[itemId];
          if (!existing || !removed || removedIndex < 0) return prev;
          const next = [...existing.comments];
          next.splice(removedIndex, 0, removed);
          return { ...prev, [itemId]: { ...existing, comments: next } };
        });
        return false;
      }
    },
    []
  );

  const getCommentState = useCallback(
    (itemId: string): CommentState => {
      return (
        commentStates[itemId] ?? { comments: [], isLoading: false, error: null }
      );
    },
    [commentStates]
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

  const removeCommentsByUser = useCallback((userId: string) => {
    setCommentStates((prev) => {
      const next: Record<string, CommentState> = {};
      for (const [itemId, state] of Object.entries(prev)) {
        next[itemId] = {
          ...state,
          comments: state.comments.filter((c) => c.userId !== userId),
        };
      }
      return next;
    });
  }, []);

  return {
    toggleLike,
    loadComments,
    addComment,
    editComment,
    deleteComment,
    getCommentState,
    reportItem,
    hasReported,
    blockUser,
    hasBlocked,
    removeCommentsByUser,
  };
}

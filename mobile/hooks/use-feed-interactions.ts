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

type UseFeedInteractionsReturn = {
  /** Toggle like on a feed item. Returns the new liked state and count. */
  toggleLike: (itemId: string) => Promise<LikeResponse | null>;

  /** Load all comments for a feed item (call when the sheet opens). */
  loadComments: (itemId: string) => Promise<void>;

  /** Add a comment to a feed item. Returns the new comment. */
  addComment: (itemId: string, text: string, currentUserId: string, currentUserName: string, currentUserPhoto?: string) => Promise<FeedComment | null>;

  /** Get cached comment state for an item. */
  getCommentState: (itemId: string) => CommentState;
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

  const getCommentState = useCallback(
    (itemId: string): CommentState => {
      return (
        commentStates[itemId] ?? { comments: [], isLoading: false, error: null }
      );
    },
    [commentStates]
  );

  return { toggleLike, loadComments, addComment, getCommentState };
}

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

export type NotificationType =
  | 'FRIEND_REQUEST_RECEIVED'
  | 'FRIEND_REQUEST_ACCEPTED'
  | 'SHIFT_CONFIRMED'
  | 'SHIFT_WAITLISTED'
  | 'SHIFT_CANCELED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'SHIFT_CANCELLATION_MANAGER'
  | 'FLEXIBLE_PLACEMENT'
  | 'UNDERAGE_USER_REGISTERED'
  | 'SURVEY_ASSIGNED'
  | 'FEED_ITEM_LIKED'
  | 'FEED_ITEM_COMMENTED'
  | 'FEED_ITEM_COMMENT_REPLY';

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl: string | null;
  relatedId: string | null;
  createdAt: string;
};

type ListResponse = {
  notifications: AppNotification[];
  totalCount: number;
  hasMore: boolean;
  unreadCount: number;
};

type UseNotificationsReturn = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const NOTIFICATIONS_KEY = queryKeys.notifications.list();

function patchList(
  client: QueryClient,
  patch: (prev: ListResponse) => ListResponse
) {
  client.setQueryData<ListResponse>(NOTIFICATIONS_KEY, (prev) =>
    prev ? patch(prev) : prev
  );
}

export function useNotifications(): UseNotificationsReturn {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () => api<ListResponse>('/api/mobile/notifications'),
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      api(`/api/mobile/notifications/${id}`, {
        method: 'PUT',
        body: { action: 'mark_read' },
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const snapshot = queryClient.getQueryData<ListResponse>(NOTIFICATIONS_KEY);
      const target = snapshot?.notifications.find((n) => n.id === id);
      if (!target || target.isRead) return { snapshot };
      patchList(queryClient, (prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
      return { snapshot };
    },
    onError: (err, _id, ctx) => {
      console.warn('[NOTIFICATIONS] mark-as-read failed:', err);
      if (ctx?.snapshot) {
        queryClient.setQueryData(NOTIFICATIONS_KEY, ctx.snapshot);
      }
    },
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      api('/api/mobile/notifications', {
        method: 'PUT',
        body: { action: 'mark_all_read' },
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const snapshot = queryClient.getQueryData<ListResponse>(NOTIFICATIONS_KEY);
      patchList(queryClient, (prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
      return { snapshot };
    },
    onError: (err, _vars, ctx) => {
      console.warn('[NOTIFICATIONS] mark-all-read failed:', err);
      if (ctx?.snapshot) {
        queryClient.setQueryData(NOTIFICATIONS_KEY, ctx.snapshot);
      }
    },
  });

  const removeNotification = useMutation({
    mutationFn: (id: string) =>
      api(`/api/mobile/notifications/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const snapshot = queryClient.getQueryData<ListResponse>(NOTIFICATIONS_KEY);
      const removed = snapshot?.notifications.find((n) => n.id === id);
      if (!removed) return { snapshot };
      patchList(queryClient, (prev) => ({
        ...prev,
        notifications: prev.notifications.filter((n) => n.id !== id),
        unreadCount: removed.isRead
          ? prev.unreadCount
          : Math.max(0, prev.unreadCount - 1),
      }));
      return { snapshot };
    },
    onError: (err, _id, ctx) => {
      console.warn('[NOTIFICATIONS] delete failed:', err);
      if (ctx?.snapshot) {
        queryClient.setQueryData(NOTIFICATIONS_KEY, ctx.snapshot);
      }
    },
  });

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isPending,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : 'Failed to load notifications'
      : null,
    refresh: async () => {
      await query.refetch();
    },
    markAsRead: async (id) => {
      await markRead.mutateAsync(id).catch(() => {});
    },
    markAllAsRead: async () => {
      await markAllRead.mutateAsync().catch(() => {});
    },
    remove: async (id) => {
      await removeNotification.mutateAsync(id).catch(() => {});
    },
  };
}

/**
 * Read the current unread count straight from the cache. Used by the OS
 * badge sync in `_layout.tsx` — it doesn't need to subscribe to the hook,
 * just react to cache updates via {@link subscribeToNotificationsUnread}.
 */
export function getUnreadCount(client: QueryClient): number {
  return (
    client.getQueryData<ListResponse>(NOTIFICATIONS_KEY)?.unreadCount ?? 0
  );
}

/**
 * Subscribe to unreadCount changes in the notifications query. Fires the
 * callback only when the count actually changes (deduped). Returns an
 * unsubscribe function.
 */
export function subscribeToNotificationsUnread(
  client: QueryClient,
  onChange: (count: number) => void
): () => void {
  let last = getUnreadCount(client);
  return client.getQueryCache().subscribe((event) => {
    const key = event.query.queryKey;
    if (key[0] !== 'notifications') return;
    const next = getUnreadCount(client);
    if (next !== last) {
      last = next;
      onChange(next);
    }
  });
}

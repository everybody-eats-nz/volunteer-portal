import { useCallback, useEffect, useState } from 'react';

import { api } from '@/lib/api';

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
  | 'SURVEY_ASSIGNED';

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

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const result = await api<ListResponse>('/api/mobile/notifications');
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load notifications',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update — roll back on failure.
    let wasUnread = false;
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          wasUnread = !n.isRead;
          return { ...n, isRead: true };
        }
        return n;
      }),
    );
    if (wasUnread) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    try {
      await api(`/api/mobile/notifications/${id}`, {
        method: 'PUT',
        body: { action: 'mark_read' },
      });
    } catch (err) {
      console.warn('[NOTIFICATIONS] mark-as-read failed:', err);
      if (wasUnread) {
        setUnreadCount((c) => c + 1);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)),
        );
      }
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const previous = notifications;
    const previousUnread = unreadCount;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await api('/api/mobile/notifications', {
        method: 'PUT',
        body: { action: 'mark_all_read' },
      });
    } catch (err) {
      console.warn('[NOTIFICATIONS] mark-all-read failed:', err);
      setNotifications(previous);
      setUnreadCount(previousUnread);
    }
  }, [notifications, unreadCount]);

  const remove = useCallback(
    async (id: string) => {
      const removed = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (removed && !removed.isRead) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }

      try {
        await api(`/api/mobile/notifications/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('[NOTIFICATIONS] delete failed:', err);
        if (removed) {
          setNotifications((prev) => [removed, ...prev]);
          if (!removed.isRead) {
            setUnreadCount((c) => c + 1);
          }
        }
      }
    },
    [notifications],
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    remove,
  };
}

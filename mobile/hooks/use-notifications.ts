import { useEffect } from 'react';
import { create } from 'zustand';

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

type NotificationState = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  hasFetched: boolean;
  fetch: () => Promise<void>;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useNotificationsStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: true,
  error: null,
  hasFetched: false,

  fetch: async () => {
    try {
      set({ error: null });
      const result = await api<ListResponse>('/api/mobile/notifications');
      set({
        notifications: result.notifications,
        unreadCount: result.unreadCount,
        hasFetched: true,
      });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : 'Failed to load notifications',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  refresh: async () => {
    set({ isLoading: true });
    await get().fetch();
  },

  markAsRead: async (id) => {
    const target = get().notifications.find((n) => n.id === id);
    if (!target) return;
    const wasUnread = !target.isRead;

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
      unreadCount: wasUnread
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }));

    try {
      await api(`/api/mobile/notifications/${id}`, {
        method: 'PUT',
        body: { action: 'mark_read' },
      });
    } catch (err) {
      console.warn('[NOTIFICATIONS] mark-as-read failed:', err);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: false } : n,
        ),
        unreadCount: wasUnread ? state.unreadCount + 1 : state.unreadCount,
      }));
    }
  },

  markAllAsRead: async () => {
    const previous = get().notifications;
    const previousUnread = get().unreadCount;

    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));

    try {
      await api('/api/mobile/notifications', {
        method: 'PUT',
        body: { action: 'mark_all_read' },
      });
    } catch (err) {
      console.warn('[NOTIFICATIONS] mark-all-read failed:', err);
      set({ notifications: previous, unreadCount: previousUnread });
    }
  },

  remove: async (id) => {
    const removed = get().notifications.find((n) => n.id === id);
    if (!removed) return;

    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: !removed.isRead
        ? Math.max(0, state.unreadCount - 1)
        : state.unreadCount,
    }));

    try {
      await api(`/api/mobile/notifications/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('[NOTIFICATIONS] delete failed:', err);
      set((state) => ({
        notifications: [removed, ...state.notifications],
        unreadCount: !removed.isRead
          ? state.unreadCount + 1
          : state.unreadCount,
      }));
    }
  },
}));

export function useNotifications(): UseNotificationsReturn {
  const notifications = useNotificationsStore((s) => s.notifications);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const isLoading = useNotificationsStore((s) => s.isLoading);
  const error = useNotificationsStore((s) => s.error);
  const hasFetched = useNotificationsStore((s) => s.hasFetched);
  const fetchNotifications = useNotificationsStore((s) => s.fetch);
  const refresh = useNotificationsStore((s) => s.refresh);
  const markAsRead = useNotificationsStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead);
  const remove = useNotificationsStore((s) => s.remove);

  useEffect(() => {
    if (!hasFetched) {
      void fetchNotifications();
    }
  }, [hasFetched, fetchNotifications]);

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

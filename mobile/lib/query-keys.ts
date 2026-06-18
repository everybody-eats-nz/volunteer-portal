/**
 * Central registry of React Query keys. Keep all keys here so that
 * `queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all })`
 * stays type-safe and grep-able as the cache surface grows.
 */
export const queryKeys = {
  shifts: {
    all: ['shifts'] as const,
    list: () => [...queryKeys.shifts.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.shifts.all, 'detail', id] as const,
    concurrent: (id: string) =>
      [...queryKeys.shifts.all, 'concurrent', id] as const,
  },
  profile: {
    me: ['profile', 'me'] as const,
    user: (id: string) => ['profile', 'user', id] as const,
  },
  friends: {
    all: ['friends'] as const,
    list: () => [...queryKeys.friends.all, 'list'] as const,
    recommended: () => [...queryKeys.friends.all, 'recommended'] as const,
  },
  feed: {
    all: ['feed'] as const,
    list: () => [...queryKeys.feed.all, 'list'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => [...queryKeys.notifications.all, 'list'] as const,
  },
  team: {
    all: ['team'] as const,
    unreadCount: () => [...queryKeys.team.all, 'unread-count'] as const,
  },
  admin: {
    all: ['admin'] as const,
    threads: (status: string, q: string) =>
      [...queryKeys.admin.all, 'threads', status, q] as const,
    thread: (id: string) => [...queryKeys.admin.all, 'thread', id] as const,
    unreadCount: () => [...queryKeys.admin.all, 'unread-count'] as const,
    locations: () => [...queryKeys.admin.all, 'locations'] as const,
    messageNotifyPref: () =>
      [...queryKeys.admin.all, 'message-notify-pref'] as const,
    today: (date: string, location: string | null) =>
      [...queryKeys.admin.all, 'today', date, location ?? 'all'] as const,
    pending: (location: string | null) =>
      [...queryKeys.admin.all, 'pending', location ?? 'all'] as const,
  },
  feedComments: {
    all: ['feed', 'comments'] as const,
    forItem: (itemId: string) => [...queryKeys.feedComments.all, itemId] as const,
  },
} as const;

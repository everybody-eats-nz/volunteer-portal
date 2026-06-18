import { useQuery, type QueryClient } from "@tanstack/react-query";

import {
  fetchAdminPending,
  fetchAdminThread,
  fetchAdminThreads,
  fetchAdminToday,
  fetchAdminUnreadCount,
  type ThreadStatus,
} from "@/lib/admin";
import { queryKeys } from "@/lib/query-keys";

const UNREAD_POLL_MS = 30_000;
const UNREAD_KEY = queryKeys.admin.unreadCount();

/**
 * Read (and poll) the admin inbox unread count. Mount anywhere the badge is
 * needed; React Query dedupes extra mounts. Only runs for admins (`enabled`).
 */
export function useAdminUnreadCount(enabled: boolean = true): number {
  const query = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => fetchAdminUnreadCount().then((r) => r.count),
    refetchInterval: enabled ? UNREAD_POLL_MS : false,
    refetchIntervalInBackground: false,
    enabled,
  });
  return query.data ?? 0;
}

/** Imperatively clear the admin unread badge after the inbox is viewed. */
export function clearAdminUnreadCount(client: QueryClient) {
  client.setQueryData<number>(UNREAD_KEY, 0);
}

/** Thread list for the inbox, filtered by status + search. */
export function useAdminThreads(opts: {
  status: ThreadStatus | "ALL";
  search: string;
}) {
  return useQuery({
    queryKey: queryKeys.admin.threads(opts.status, opts.search),
    queryFn: () =>
      fetchAdminThreads({
        status: opts.status,
        search: opts.search || undefined,
      }).then((r) => r.threads),
  });
}

/** Single thread + messages for the conversation screen. */
export function useAdminThread(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.thread(id),
    queryFn: () => fetchAdminThread(id),
    enabled: !!id,
  });
}

/** Shifts for a given service day (default today, resolved server-side). */
export function useAdminToday(date: string) {
  return useQuery({
    queryKey: queryKeys.admin.today(date),
    queryFn: () => fetchAdminToday(date || undefined).then((r) => r.shifts),
  });
}

/** Pending signups awaiting approval. */
export function useAdminPending() {
  return useQuery({
    queryKey: queryKeys.admin.pending(),
    queryFn: () => fetchAdminPending().then((r) => r.signups),
  });
}

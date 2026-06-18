import {
  useMutation,
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";

import {
  fetchAdminLocations,
  fetchAdminMessageNotifyPref,
  fetchAdminPending,
  fetchAdminThread,
  fetchAdminThreads,
  fetchAdminToday,
  fetchAdminUnreadCount,
  setAdminMessageNotifyPref,
  type ThreadStatus,
} from "@/lib/admin";
import { queryClient } from "@/lib/query-client";
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

/**
 * Shifts for a given service day (default today, resolved server-side),
 * optionally scoped to a single restaurant.
 */
export function useAdminToday(date: string, location: string | null = null) {
  return useQuery({
    queryKey: queryKeys.admin.today(date, location),
    queryFn: () =>
      fetchAdminToday(date || undefined, location ?? undefined).then(
        (r) => r.shifts
      ),
  });
}

/** Pending signups awaiting approval, optionally scoped to one restaurant. */
export function useAdminPending(location: string | null = null) {
  return useQuery({
    queryKey: queryKeys.admin.pending(location),
    queryFn: () =>
      fetchAdminPending(location ?? undefined).then((r) => r.signups),
  });
}

/** Active restaurants for the admin location filter. */
export function useAdminLocations() {
  return useQuery({
    queryKey: queryKeys.admin.locations(),
    queryFn: () => fetchAdminLocations().then((r) => r.locations),
    staleTime: 5 * 60_000,
  });
}

/**
 * Per-admin "push me when a volunteer messages the team" preference, plus a
 * mutation to flip it. Optimistically updates the cache so the toggle feels
 * instant, rolling back on error.
 */
export function useAdminMessageNotifyPref() {
  const query = useQuery({
    queryKey: queryKeys.admin.messageNotifyPref(),
    queryFn: () => fetchAdminMessageNotifyPref().then((r) => r.enabled),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (enabled: boolean) =>
      setAdminMessageNotifyPref(enabled).then((r) => r.enabled),
    onMutate: (enabled) => {
      const key = queryKeys.admin.messageNotifyPref();
      const previous = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData<boolean>(key, enabled);
      return { previous };
    },
    onError: (_err, _enabled, context) => {
      queryClient.setQueryData(
        queryKeys.admin.messageNotifyPref(),
        context?.previous ?? false
      );
    },
    onSuccess: (enabled) => {
      queryClient.setQueryData(queryKeys.admin.messageNotifyPref(), enabled);
    },
  });

  return {
    enabled: query.data ?? false,
    isLoading: query.isPending,
    setEnabled: mutation.mutate,
    isSaving: mutation.isPending,
  };
}

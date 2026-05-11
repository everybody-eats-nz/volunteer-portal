import { useQuery, type QueryClient } from "@tanstack/react-query";

import { fetchTeamUnreadCount } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

const POLL_INTERVAL_MS = 30_000;
const KEY = queryKeys.team.unreadCount();

/**
 * Read (and poll) the team-help unread count. Mount in any component that
 * needs the count — extra mounts are deduped by React Query and share the
 * same 30s refetch schedule.
 */
export function useTeamUnreadCount(enabled: boolean = true): number {
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => fetchTeamUnreadCount().then((r) => r.count),
    refetchInterval: enabled ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    enabled,
  });
  return query.data ?? 0;
}

/** Imperatively clear the count after the user reads the thread. */
export function clearTeamUnreadCount(client: QueryClient) {
  client.setQueryData<number>(KEY, 0);
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotificationStream } from "@/hooks/use-notification-stream";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 60_000;

interface AdminMessagesBellProps {
  /**
   * Open an SSE connection so the badge updates the moment a volunteer writes
   * in. Only one mounted bell should do this — a second EventSource for the
   * same admin is a wasted connection, not a second source of truth. The
   * admin layout's copy subscribes; the site header's copy refetches instead.
   */
  subscribe?: boolean;
  className?: string;
}

/**
 * Unread volunteer messages, surfaced next to (but deliberately apart from)
 * the notification bell.
 *
 * Messages never become Notification rows for admins — see `messaging-notify`
 * — so they cannot appear in the bell's feed and would otherwise only be
 * visible on the Messages page itself. This is their header presence: one
 * click to the inbox, and a count that says whether anyone is waiting on a
 * reply.
 */
export function AdminMessagesBell({
  subscribe = false,
  className,
}: AdminMessagesBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/messages/unread-count");
      if (!response.ok) return;
      const data = await response.json();
      setUnreadCount(data.count ?? 0);
    } catch (error) {
      console.error("Error fetching unread message count:", error);
    }
  }, []);

  // Re-read on every admin navigation. Unread is derived from the thread's
  // team-read marker, so opening a thread changes the count server-side with
  // nothing pushed back to us — navigating away is when we find out.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUnreadCount();
  }, [pathname, fetchUnreadCount]);

  // A tab left open all afternoon is the normal case for an admin, so catch up
  // whenever it comes back to the foreground.
  useEffect(() => {
    const onFocus = () => fetchUnreadCount();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchUnreadCount]);

  // SSE is the fast path, not the only one: a dropped stream must not leave an
  // admin staring at a stale zero while a volunteer waits for a reply. Polls
  // only while the tab is visible, so a backgrounded admin tab costs nothing.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchUnreadCount();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  useNotificationStream({
    enabled: subscribe,
    onNewNotification: (notification) => {
      if (notification?.kind === "direct_message") {
        fetchUnreadCount();
      }
    },
  });

  const label =
    unreadCount > 0
      ? `Messages (${unreadCount} unread)`
      : "Messages";

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      // The visual size matches the controls beside it; the pseudo-element
      // pads the hit area out to the 44px touch minimum without disturbing
      // the toolbar's rhythm.
      className={cn(
        "relative rounded-full p-2",
        "after:absolute after:content-[''] after:-inset-x-1 after:-inset-y-1.5",
        className
      )}
      data-testid="admin-messages-button"
    >
      <Link href="/admin/messages" aria-label={label}>
        <MessageSquare className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 right-0 h-5 min-w-5 rounded-full p-0 px-1 flex items-center justify-center text-xs bg-emerald-700 text-white hover:bg-emerald-700"
            data-testid="admin-messages-count-badge"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
        <span className="sr-only">{label}</span>
      </Link>
    </Button>
  );
}

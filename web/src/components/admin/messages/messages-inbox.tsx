"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, MessageSquarePlus, Search } from "lucide-react";

import { useNotificationStream } from "@/hooks/use-notification-stream";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ThreadList } from "./thread-list";
import { ThreadView } from "./thread-view";
import { ComposeButton } from "./compose-button";
import type { InboxRealtimeEvent, SerializedThread } from "./types";

interface MessagesInboxProps {
  initialThreads: SerializedThread[];
  initialSelectedId: string | null;
  locations: string[];
}

export function MessagesInbox({
  initialThreads,
  initialSelectedId,
  locations,
}: MessagesInboxProps) {
  const router = useRouter();
  const [threads, setThreads] = useState<SerializedThread[]>(initialThreads);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? initialThreads[0]?.id ?? null
  );
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "RESOLVED" | "ALL">(
    "OPEN"
  );
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [browserNotificationsOn, setBrowserNotificationsOn] = useState(false);

  // Reload threads when filters change.
  const fetchThreads = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("status", statusFilter);
    if (unreadOnly) params.set("unread", "true");
    if (locationFilter) params.set("location", locationFilter);
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/admin/messages/threads?${params}`);
    if (!res.ok) return;
    const data = (await res.json()) as { threads: SerializedThread[] };
    setThreads(data.threads);
  }, [statusFilter, unreadOnly, locationFilter, search]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const run = async () => {
      try {
        const params = new URLSearchParams();
        params.set("status", statusFilter);
        if (unreadOnly) params.set("unread", "true");
        if (locationFilter) params.set("location", locationFilter);
        if (search.trim()) params.set("q", search.trim());
        const res = await fetch(`/api/admin/messages/threads?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { threads: SerializedThread[] };
        if (!cancelled) setThreads(data.threads);
      } catch {
        // ignore aborted/failed
      }
    };
    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [statusFilter, unreadOnly, locationFilter, search]);

  // Sync selected thread to URL.
  useEffect(() => {
    if (!selectedId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("thread") !== selectedId) {
      url.searchParams.set("thread", selectedId);
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [selectedId, router]);

  // Realtime: when a new message arrives in a thread, bump it to the top
  // and show as unread. If we're not currently viewing it, surface a
  // browser notification.
  const onNewNotification = useCallback(
    (raw: Record<string, unknown>) => {
      const evt = raw as Partial<InboxRealtimeEvent>;
      if (evt.kind !== "direct_message" || !evt.threadId || !evt.directMessage) {
        return;
      }
      setThreads((prev) => {
        const idx = prev.findIndex((t) => t.id === evt.threadId);
        const isVolunteerSender = evt.directMessage!.senderRole === "VOLUNTEER";
        if (idx === -1) {
          // New thread we haven't seen yet — refetch the list.
          void fetchThreads();
          return prev;
        }
        const updated: SerializedThread = {
          ...prev[idx],
          lastMessageAt: evt.directMessage!.createdAt,
          unreadForTeam: isVolunteerSender
            ? selectedId !== evt.threadId
            : prev[idx].unreadForTeam,
          lastMessage: {
            body: evt.directMessage!.body,
            senderRole: evt.directMessage!.senderRole,
            createdAt: evt.directMessage!.createdAt,
          },
          status: "OPEN",
        };
        const next = [updated, ...prev.filter((_, i) => i !== idx)];
        return next;
      });

      const isVolunteerSender = evt.directMessage!.senderRole === "VOLUNTEER";
      if (
        browserNotificationsOn &&
        isVolunteerSender &&
        document.visibilityState !== "visible" &&
        evt.threadId !== selectedId
      ) {
        showBrowserNotification(
          evt.volunteer?.name ?? "Volunteer",
          evt.directMessage!.body
        );
      }
    },
    [browserNotificationsOn, fetchThreads, selectedId]
  );

  useNotificationStream({
    onNewNotification,
    enabled: true,
  });

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // Mark selected thread as read on open.
  const lastReadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) return;
    if (lastReadRef.current === selectedId) return;
    lastReadRef.current = selectedId;
    void fetch(`/api/admin/messages/threads/${selectedId}/read`, {
      method: "POST",
    }).then(() => {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedId ? { ...t, unreadForTeam: false } : t
        )
      );
    });
  }, [selectedId]);

  const handleMessageSent = useCallback(
    (threadId: string, body: string, createdAt: string) => {
      setThreads((prev) => {
        const idx = prev.findIndex((t) => t.id === threadId);
        if (idx === -1) return prev;
        const updated: SerializedThread = {
          ...prev[idx],
          lastMessageAt: createdAt,
          lastMessage: { body, senderRole: "ADMIN", createdAt },
          unreadForTeam: false,
          status: "OPEN",
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    },
    []
  );

  const handleResolve = useCallback(
    async (threadId: string, status: "OPEN" | "RESOLVED") => {
      await fetch(`/api/admin/messages/threads/${threadId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, status } : t))
      );
    },
    []
  );

  const handleNewThread = useCallback((threadId: string) => {
    setSelectedId(threadId);
    void fetchThreads();
  }, [fetchThreads]);

  const toggleBrowserNotifications = useCallback(async () => {
    if (browserNotificationsOn) {
      setBrowserNotificationsOn(false);
      return;
    }
    if (typeof Notification === "undefined") {
      alert("This browser doesn't support notifications.");
      return;
    }
    if (Notification.permission === "denied") {
      alert("Notifications are blocked. Enable them in your browser settings.");
      return;
    }
    const result =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    setBrowserNotificationsOn(result === "granted");
  }, [browserNotificationsOn]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={locationFilter || "ALL"}
          onValueChange={(v) => setLocationFilter(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnreadOnly((v) => !v)}
        >
          Unread
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleBrowserNotifications}
            title={
              browserNotificationsOn
                ? "Notifications on"
                : "Get desktop notifications"
            }
          >
            {browserNotificationsOn ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">
              {browserNotificationsOn ? "Notifications on" : "Notify me"}
            </span>
          </Button>
          <ComposeButton onCreated={handleNewThread}>
            <MessageSquarePlus className="w-4 h-4 mr-1.5" />
            New message
          </ComposeButton>
        </div>
      </div>

      {/* Two-pane */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[360px_1fr] gap-4 min-h-[70vh]">
        <div className="border rounded-lg bg-card overflow-hidden flex flex-col max-h-[78vh]">
          <ThreadList
            threads={threads}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>
        <div className="border rounded-lg bg-card overflow-hidden flex flex-col min-h-[60vh] max-h-[78vh]">
          {selectedId ? (
            <ThreadView
              key={selectedId}
              threadId={selectedId}
              onMessageSent={handleMessageSent}
              onResolve={handleResolve}
            />
          ) : (
            <EmptyPane />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyPane() {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-6 py-16">
      <div>
        <p className="text-lg font-medium mb-1">No conversation selected</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Pick a conversation on the left, or start a new one with the
          <span className="font-medium"> New message</span> button.
        </p>
      </div>
    </div>
  );
}

function showBrowserNotification(title: string, body: string) {
  try {
    const n = new Notification(`${title} · Everybody Eats`, { body });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (err) {
    console.warn("[messages] Failed to show browser notification", err);
  }
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ExternalLink, Loader2, Send } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useNotificationStream } from "@/hooks/use-notification-stream";
import { cn } from "@/lib/utils";

import type {
  InboxRealtimeEvent,
  SerializedMessage,
  ThreadDetail,
} from "./types";

interface ThreadViewProps {
  threadId: string;
  onMessageSent: (threadId: string, body: string, createdAt: string) => void;
  onResolve: (threadId: string, status: "OPEN" | "RESOLVED") => void;
}

export function ThreadView({ threadId, onMessageSent, onResolve }: ThreadViewProps) {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [messages, setMessages] = useState<SerializedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/admin/messages/threads/${threadId}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      thread: ThreadDetail & {
        lastMessageAt: string;
        teamLastReadAt: string | null;
        volunteerLastReadAt: string | null;
      };
      messages: SerializedMessage[];
      upcomingShiftCount: number;
    };
    setThread({ ...data.thread, upcomingShiftCount: data.upcomingShiftCount });
    setMessages(data.messages);
  }, [threadId]);

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Realtime: append messages for this thread without refetching.
  useNotificationStream({
    onNewNotification: useCallback(
      (raw: Record<string, unknown>) => {
        const evt = raw as Partial<InboxRealtimeEvent>;
        if (
          evt.kind !== "direct_message" ||
          evt.threadId !== threadId ||
          !evt.directMessage
        ) {
          return;
        }
        // Avoid duplicating our own optimistic send.
        setMessages((prev) => {
          if (prev.some((m) => m.id === evt.directMessage!.id)) return prev;
          return [
            ...prev,
            {
              id: evt.directMessage!.id,
              body: evt.directMessage!.body,
              senderId: evt.directMessage!.senderId,
              senderRole: evt.directMessage!.senderRole,
              createdAt: evt.directMessage!.createdAt,
              sender: {
                id: evt.directMessage!.senderId,
                firstName: null,
                lastName: null,
                name: evt.volunteer?.name ?? null,
                profilePhotoUrl: null,
              },
            },
          ];
        });
        // Mark thread as read on receipt while it's open.
        void fetch(`/api/admin/messages/threads/${threadId}/read`, {
          method: "POST",
        });
      },
      [threadId]
    ),
  });

  const send = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `/api/admin/messages/threads/${threadId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmed }),
        }
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error ?? "Failed to send");
        return;
      }
      const data = (await res.json()) as { message: SerializedMessage };
      setMessages((prev) => [...prev, data.message]);
      setBody("");
      onMessageSent(threadId, trimmed, data.message.createdAt);
    } finally {
      setSending(false);
    }
  }, [body, sending, threadId, onMessageSent]);

  const handleResolveClick = useCallback(() => {
    if (!thread) return;
    const next = thread.status === "OPEN" ? "RESOLVED" : "OPEN";
    onResolve(threadId, next);
    setThread({ ...thread, status: next });
  }, [thread, threadId, onResolve]);

  if (loading || !thread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const volunteerName =
    [thread.volunteer.firstName, thread.volunteer.lastName]
      .filter(Boolean)
      .join(" ") ||
    thread.volunteer.name ||
    thread.volunteer.email;

  return (
    <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_280px] min-h-0">
      <div className="flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="size-9">
              <AvatarImage
                src={thread.volunteer.profilePhotoUrl ?? undefined}
                alt={volunteerName}
              />
              <AvatarFallback>
                {volunteerName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{volunteerName}</span>
                {thread.status === "RESOLVED" && (
                  <Badge variant="secondary" className="text-[10px]">
                    Resolved
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {thread.volunteer.email}
                {thread.volunteer.defaultLocation
                  ? ` · ${thread.volunteer.defaultLocation}`
                  : ""}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleResolveClick}
            title={
              thread.status === "OPEN" ? "Mark resolved" : "Reopen thread"
            }
          >
            {thread.status === "OPEN" ? (
              <>
                <Archive className="w-4 h-4 mr-1.5" />
                Resolve
              </>
            ) : (
              <>
                <ArchiveRestore className="w-4 h-4 mr-1.5" />
                Reopen
              </>
            )}
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No messages yet — say kia ora to {volunteerName.split(" ")[0]}.
            </div>
          ) : (
            messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                message={m}
                showSender={i === 0 || messages[i - 1].senderId !== m.senderId}
              />
            ))
          )}
        </div>

        {/* Composer */}
        <div className="border-t p-3 flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Reply to ${volunteerName.split(" ")[0]}…`}
            rows={2}
            className="resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button onClick={send} disabled={!body.trim() || sending}>
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Sidebar context */}
      <aside className="hidden xl:block border-l p-4 overflow-y-auto bg-muted/20">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
          Volunteer context
        </p>
        <dl className="space-y-2.5 text-sm">
          <ContextRow label="Email" value={thread.volunteer.email} />
          <ContextRow label="Phone" value={thread.volunteer.phone ?? "—"} />
          <ContextRow
            label="Home location"
            value={thread.volunteer.defaultLocation ?? "—"}
          />
          <ContextRow
            label="Grade"
            value={
              <Badge variant="outline" className="text-[10px]">
                {thread.volunteer.volunteerGrade}
              </Badge>
            }
          />
          <ContextRow
            label="Upcoming shifts"
            value={String(thread.upcomingShiftCount)}
          />
        </dl>
        <Link
          href={`/admin/users/${thread.volunteer.id}`}
          className="mt-4 inline-flex items-center text-xs font-medium text-emerald-700 hover:underline"
        >
          Open full profile <ExternalLink className="w-3 h-3 ml-1" />
        </Link>
      </aside>
    </div>
  );
}

function ContextRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function MessageBubble({
  message,
  showSender,
}: {
  message: SerializedMessage;
  showSender: boolean;
}) {
  const isAdmin = message.senderRole === "ADMIN";
  const senderName =
    [message.sender.firstName, message.sender.lastName]
      .filter(Boolean)
      .join(" ") || message.sender.name || "";

  return (
    <div className={cn("flex flex-col", isAdmin ? "items-end" : "items-start")}>
      {showSender && (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 px-1">
          {isAdmin
            ? `${senderName || "Admin"} · ${formatTime(message.createdAt)}`
            : `${senderName || "Volunteer"} · ${formatTime(message.createdAt)}`}
        </span>
      )}
      <div
        className={cn(
          "max-w-[75%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words",
          isAdmin
            ? "bg-emerald-700 text-white rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        )}
      >
        {message.body}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
  });
}

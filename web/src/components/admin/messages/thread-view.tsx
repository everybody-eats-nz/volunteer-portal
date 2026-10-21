"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  Info,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import type { StatusTone } from "@/lib/status-styles";
import { useNotificationStream } from "@/hooks/use-notification-stream";
import { cn } from "@/lib/utils";

import type {
  InboxRealtimeEvent,
  NextShiftSummary,
  SerializedMessage,
  ThreadDetail,
} from "./types";
import { volunteerProfileHref } from "@/lib/admin-navigation";

interface ThreadResponse {
  thread: ThreadDetail & {
    lastMessageAt: string;
    teamLastReadAt: string | null;
    volunteerLastReadAt: string | null;
  };
  messages: SerializedMessage[];
  upcomingShiftCount: number;
  nextShift: NextShiftSummary | null;
}

const NO_MESSAGES: SerializedMessage[] = [];

interface ThreadViewProps {
  threadId: string;
  onMessageSent: (threadId: string, body: string, createdAt: string) => void;
  onResolve: (threadId: string, status: "OPEN" | "RESOLVED") => void;
}

export function ThreadView({ threadId, onMessageSent, onResolve }: ThreadViewProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, mutate } = useSWR<ThreadResponse>(
    `/api/admin/messages/threads/${threadId}`
  );
  const thread: ThreadDetail | null = data
    ? {
        ...data.thread,
        upcomingShiftCount: data.upcomingShiftCount,
        nextShift: data.nextShift,
      }
    : null;
  const messages = data?.messages ?? NO_MESSAGES;

  /** Adds a message locally, ignoring one we already have (our own send). */
  const appendMessage = useCallback(
    (message: SerializedMessage) =>
      mutate(
        (current) =>
          current && !current.messages.some((m) => m.id === message.id)
            ? { ...current, messages: [...current.messages, message] }
            : current,
        { revalidate: false }
      ),
    [mutate]
  );

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
        void appendMessage({
          id: evt.directMessage.id,
          body: evt.directMessage.body,
          senderId: evt.directMessage.senderId,
          senderRole: evt.directMessage.senderRole,
          createdAt: evt.directMessage.createdAt,
          sender: {
            id: evt.directMessage.senderId,
            firstName: null,
            lastName: null,
            name: evt.volunteer?.name ?? null,
            profilePhotoUrl: null,
          },
        });
        // Mark thread as read on receipt while it's open.
        void fetch(`/api/admin/messages/threads/${threadId}/read`, {
          method: "POST",
        });
      },
      [threadId, appendMessage]
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
        toast.error(err.error ?? "Failed to send");
        return;
      }
      const data = (await res.json()) as { message: SerializedMessage };
      void appendMessage(data.message);
      setBody("");
      onMessageSent(threadId, trimmed, data.message.createdAt);
    } finally {
      setSending(false);
    }
  }, [body, sending, threadId, onMessageSent, appendMessage]);

  const status = data?.thread.status;
  const handleResolveClick = useCallback(() => {
    if (!status) return;
    const next = status === "OPEN" ? "RESOLVED" : "OPEN";
    onResolve(threadId, next);
    void mutate(
      (current) =>
        current && { ...current, thread: { ...current.thread, status: next } },
      { revalidate: false }
    );
  }, [status, threadId, onResolve, mutate]);

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center" role="status">
        <Loader2
          className="w-5 h-5 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <span className="sr-only">Loading conversation</span>
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
                  <StatusBadge tone="confirmed">Resolved</StatusBadge>
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
                <Archive className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Resolve
              </>
            ) : (
              <>
                <ArchiveRestore className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Reopen
              </>
            )}
          </Button>
        </div>

        {/* No-mobile-app hint: replies create a bell notification but won't
            push, so flag it to admins before they compose. */}
        {!thread.volunteer.hasMobileApp && (
          <div className="flex items-start gap-2 border-b bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
            <Info className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
            <p>
              {volunteerName.split(" ")[0]} hasn&apos;t signed in on the mobile
              app, so replies won&apos;t send a push notification — they&apos;ll
              only see it when they next open the web portal.
            </p>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description={`Say kia ora to ${volunteerName.split(" ")[0]}.`}
            />
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
            aria-label={`Reply to ${volunteerName}`}
            rows={2}
            className="resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <Button
            onClick={send}
            disabled={!body.trim() || sending}
            aria-label={sending ? "Sending reply" : `Send reply to ${volunteerName}`}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="w-4 h-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Sidebar context */}
      <aside className="hidden xl:block border-l p-4 overflow-y-auto bg-muted/20">
        <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">
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
              <Badge variant="outline" className="text-xs">
                {thread.volunteer.volunteerGrade}
              </Badge>
            }
          />
          <ContextRow
            label="Upcoming shifts"
            value={String(thread.upcomingShiftCount)}
          />
        </dl>

        <p className="mt-6 text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Next shift
        </p>
        <NextShiftCard nextShift={thread.nextShift} />

        <Link
          href={volunteerProfileHref(thread.volunteer.id, "/admin/messages")}
          className="mt-4 inline-flex items-center text-xs font-medium text-emerald-700 hover:underline"
        >
          Open full profile{" "}
          <ExternalLink className="w-3 h-3 ml-1" aria-hidden="true" />
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
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
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
  const fallbackInitials = (senderName || (isAdmin ? "Admin" : "Volunteer"))
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn("flex flex-col", isAdmin ? "items-end" : "items-start")}>
      {showSender && (
        <div
          className={cn(
            "flex items-center gap-1.5 mb-1 px-1",
            isAdmin && "flex-row-reverse"
          )}
        >
          <Avatar className="size-5">
            <AvatarImage
              src={message.sender.profilePhotoUrl ?? undefined}
              alt={senderName || (isAdmin ? "Admin" : "Volunteer")}
            />
            <AvatarFallback className="text-[8px]">
              {fallbackInitials}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {senderName || (isAdmin ? "Admin" : "Volunteer")} ·{" "}
            {formatTime(message.createdAt)}
          </span>
        </div>
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

function NextShiftCard({ nextShift }: { nextShift: NextShiftSummary | null }) {
  if (!nextShift) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No upcoming shift booked.
      </p>
    );
  }

  const start = new Date(nextShift.start);
  const end = new Date(nextShift.end);
  const dateLabel = start.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Pacific/Auckland",
  });
  const timeRange = `${start.toLocaleTimeString("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Pacific/Auckland",
  })} – ${end.toLocaleTimeString("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Pacific/Auckland",
  })}`;

  return (
    <Link
      href={`/admin/shifts/${nextShift.id}/edit`}
      className="block rounded-md border bg-background p-3 text-sm hover:border-emerald-700/40 hover:bg-emerald-50/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium leading-tight">{nextShift.shiftTypeName}</div>
        <StatusBadge tone={signupTone(nextShift.signupStatus)}>
          {signupLabel(nextShift.signupStatus)}
        </StatusBadge>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{dateLabel}</div>
      <div className="text-xs text-muted-foreground">{timeRange}</div>
      {nextShift.location && (
        <div className="mt-1 text-xs">📍 {nextShift.location}</div>
      )}
      <div className="mt-2 text-xs text-muted-foreground">
        {nextShift.confirmedCount}/{nextShift.capacity} confirmed
      </div>
      {nextShift.notes && (
        <p className="mt-2 text-xs italic text-muted-foreground line-clamp-3">
          “{nextShift.notes}”
        </p>
      )}
    </Link>
  );
}

function signupTone(status: string): StatusTone {
  switch (status) {
    case "CONFIRMED":
      return "confirmed";
    case "PENDING":
    case "REGULAR_PENDING":
      return "pending";
    case "WAITLISTED":
      return "waitlisted";
    default:
      return "neutral";
  }
}

/** "REGULAR_PENDING" -> "Regular pending" */
function signupLabel(status: string): string {
  const words = status.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

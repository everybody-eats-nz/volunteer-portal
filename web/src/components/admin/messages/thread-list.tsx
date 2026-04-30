"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { SerializedThread } from "./types";

interface ThreadListProps {
  threads: SerializedThread[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ThreadList({ threads, selectedId, onSelect }: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-16 text-center">
        <div>
          <p className="text-sm font-medium mb-1">No conversations</p>
          <p className="text-xs text-muted-foreground">
            Volunteer messages will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto divide-y">
      {threads.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onSelect(t.id)}
            className={cn(
              "w-full text-left px-4 py-3 flex gap-3 items-start transition-colors hover:bg-muted/60",
              selectedId === t.id && "bg-muted"
            )}
          >
            <Avatar className="size-10 shrink-0">
              <AvatarImage
                src={t.volunteer.profilePhotoUrl ?? undefined}
                alt={t.volunteer.name}
              />
              <AvatarFallback>{getInitials(t.volunteer.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-sm truncate",
                    t.unreadForTeam ? "font-semibold" : "font-medium"
                  )}
                >
                  {t.volunteer.name}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatRelative(t.lastMessageAt)}
                </span>
              </div>
              <p
                className={cn(
                  "text-xs text-muted-foreground truncate mt-0.5",
                  t.unreadForTeam && "text-foreground"
                )}
              >
                {t.lastMessage
                  ? prefixForRole(t.lastMessage.senderRole) + t.lastMessage.body
                  : "No messages yet"}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                {t.volunteer.defaultLocation && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t.volunteer.defaultLocation}
                  </span>
                )}
                {t.status === "RESOLVED" && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted-foreground/10 rounded px-1.5 py-0.5">
                    Resolved
                  </span>
                )}
                {t.unreadForTeam && (
                  <span className="ml-auto inline-block size-2 rounded-full bg-emerald-600" />
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function prefixForRole(role: "VOLUNTEER" | "ADMIN"): string {
  return role === "ADMIN" ? "You: " : "";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

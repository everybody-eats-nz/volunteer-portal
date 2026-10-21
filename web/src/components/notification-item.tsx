"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Check } from "lucide-react";
import { Notification } from "@/generated/client";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: Notification;
  onRead?: (notificationId: string) => void;
  onDelete?: (notificationId: string) => void;
  onClick?: () => void;
}

export function NotificationItem({
  notification,
  onRead,
  onDelete,
  onClick,
}: NotificationItemProps) {
  const [deleting, setDeleting] = useState(false);
  const [marking, setMarking] = useState(false);

  const handleMarkRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (marking || notification.isRead) return;

    setMarking(true);
    try {
      await markRead();
    } finally {
      setMarking(false);
    }
  };

  const markRead = async () => {
    if (notification.isRead) return;

    try {
      const response = await fetch(`/api/notifications/${notification.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "mark_read" }),
      });

      if (response.ok) {
        onRead?.(notification.id);
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // When clicking the notification link, mark it as read (fire-and-forget so
  // navigation isn't blocked) before closing the dropdown.
  const handleLinkClick = () => {
    void markRead();
    onClick?.();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (deleting) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/notifications/${notification.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onDelete?.(notification.id);
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInHours =
      Math.abs(now.getTime() - notificationDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes < 1 ? "Just now" : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "FRIEND_REQUEST_RECEIVED":
        return "👥";
      case "FRIEND_REQUEST_ACCEPTED":
        return "✅";
      case "SHIFT_CONFIRMED":
        return "🎯";
      case "SHIFT_WAITLISTED":
        return "⏰";
      case "SHIFT_WAITLIST_OFFER":
        return "✨";
      case "SHIFT_CANCELED":
        return "❌";
      case "ACHIEVEMENT_UNLOCKED":
        return "🏆";
      default:
        return "📌";
    }
  };

  const body = (
    <div className="flex items-start gap-3">
      {/* Icon */}
      <div className="text-lg" data-testid="notification-icon" aria-hidden>
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4
          className="font-medium text-sm text-foreground"
          data-testid="notification-title"
        >
          {notification.title}
        </h4>
        <p
          className="text-sm text-muted-foreground mt-1"
          data-testid="notification-message"
        >
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="text-xs text-muted-foreground"
            data-testid="notification-time"
          >
            {formatDate(notification.createdAt)}
          </span>
          {!notification.isRead && (
            <Badge
              variant="secondary"
              className="text-xs"
              data-testid="unread-badge"
            >
              New
            </Badge>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "relative flex items-start gap-1 transition-colors group hover:bg-muted/50",
        !notification.isRead && "bg-blue-50 dark:bg-blue-950/30"
      )}
      data-testid={`notification-item-${notification.id}`}
    >
      {/* The link and the actions are siblings: a button inside a link is
          invalid HTML, and its clicks would also follow the link. */}
      {notification.actionUrl ? (
        <Link
          href={notification.actionUrl}
          className="block min-w-0 flex-1 p-4 pr-1 hover:no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          onClick={handleLinkClick}
          data-testid="notification-link"
        >
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1 p-4 pr-1">{body}</div>
      )}

      {/* Actions - always shown on touch screens, revealed on hover or
          keyboard focus where there's a pointer to hover with. */}
      <div className="flex shrink-0 items-center pt-2 pr-2 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
        {!notification.isRead && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleMarkRead}
            disabled={marking}
            className="size-10 text-muted-foreground hover:text-foreground"
            data-testid="mark-read-button"
          >
            <Check className="h-4 w-4" aria-hidden />
            <span className="sr-only">Mark as read</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={deleting}
          className="size-10 text-muted-foreground hover:text-destructive"
          data-testid="delete-notification-button"
        >
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Delete notification</span>
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Check } from "lucide-react";
import { Notification } from "@prisma/client";
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
    } finally {
      setMarking(false);
    }
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
      case "SHIFT_CANCELED":
        return "❌";
      case "GROUP_INVITATION":
        return "📧";
      case "ACHIEVEMENT_UNLOCKED":
        return "🏆";
      default:
        return "📌";
    }
  };

  const content = (
    <div
      className={cn(
        "p-4 hover:bg-muted/50 transition-colors relative group",
        !notification.isRead && "bg-blue-50 dark:bg-blue-950/30"
      )}
      data-testid={`notification-item-${notification.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="text-lg" data-testid="notification-icon">
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
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

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!notification.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkRead}
                  disabled={marking}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  data-testid="mark-read-button"
                >
                  <Check className="h-3 w-3" />
                  <span className="sr-only">Mark as read</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                data-testid="delete-notification-button"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Delete notification</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // If there's an action URL, wrap in a Link
  if (notification.actionUrl) {
    return (
      <Link
        href={notification.actionUrl}
        className="block hover:no-underline"
        onClick={onClick}
        data-testid="notification-link"
      >
        {content}
      </Link>
    );
  }

  return content;
}

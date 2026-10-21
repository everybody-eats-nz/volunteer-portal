"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationItem } from "@/components/notification-item";
import { Loader2, CheckCheck, Bell } from "lucide-react";
import { Notification } from "@/generated/client";
import { motion } from "motion/react";
import { useEntrance } from "@/hooks/use-entrance";
import { staggerContainer, staggerItem } from "@/lib/motion";

interface NotificationListProps {
  onNotificationsRead?: () => void;
  onClose?: () => void;
}

export function NotificationList({
  onNotificationsRead,
  onClose,
}: NotificationListProps) {
  const entrance = useEntrance();
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const { data, isLoading: loading, mutate } = useSWR<{
    notifications: Notification[];
  }>("/api/notifications?limit=20", {
    onError: (error) => console.error("Error fetching notifications:", error),
  });
  const notifications = data?.notifications ?? [];

  /** Applies a local change to the cached list without refetching. */
  const updateNotifications = (
    update: (notifications: Notification[]) => Notification[]
  ) =>
    void mutate(
      (current) =>
        current && {
          ...current,
          notifications: update(current.notifications),
        },
      { revalidate: false }
    );

  const handleMarkAllRead = async () => {
    if (markingAllRead) return;

    setMarkingAllRead(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "mark_all_read" }),
      });

      if (response.ok) {
        // Update local state
        updateNotifications((prev) =>
          prev.map((notification) => ({ ...notification, isRead: true }))
        );
        onNotificationsRead?.();
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationRead = (notificationId: string) => {
    updateNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );
    onNotificationsRead?.();
  };

  const handleNotificationDelete = (notificationId: string) => {
    updateNotifications((prev) =>
      prev.filter((notification) => notification.id !== notificationId)
    );
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div
        className="p-4 flex items-center justify-center text-muted-foreground"
        data-testid="notification-loading"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-6 w-6" />
        </motion.div>
        <span className="ml-2">Loading notifications...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h3
            className="font-semibold text-foreground"
            data-testid="notifications-title"
          >
            Notifications
          </h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" data-testid="unread-count-badge">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAllRead}
            className="text-foreground hover:text-foreground"
            data-testid="mark-all-read-button"
          >
            {markingAllRead ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <CheckCheck className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="ml-1">Mark all read</span>
          </Button>
        )}
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div
          className="p-8 text-center text-muted-foreground"
          data-testid="no-notifications"
        >
          <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No notifications yet</p>
          <p className="text-sm">
            You&apos;ll see friend requests and shift updates here
          </p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <motion.div
            className="divide-y"
            data-testid="notification-list"
            variants={staggerContainer}
            initial={entrance("hidden")}
            animate="visible"
          >
            {notifications.map((notification) => (
              <motion.div key={notification.id} variants={staggerItem}>
                <NotificationItem
                  notification={notification}
                  onRead={handleNotificationRead}
                  onDelete={handleNotificationDelete}
                  onClick={onClose}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}

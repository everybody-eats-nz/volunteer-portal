"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationList } from "@/components/notification-list";
import { useNotificationStream } from "@/hooks/use-notification-stream";
import { motion, AnimatePresence } from "motion/react";
import { dropdownVariants } from "@/lib/motion";

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch initial unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch("/api/notifications/unread");
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  // Set up Server-Sent Events for real-time updates
  useNotificationStream({
    onUnreadCountChange: (count) => {
      setUnreadCount(count);
    },
    onNewNotification: () => {
      // Refresh unread count when new notification arrives
      fetchUnreadCount();
    },
    enabled: !!userId,
  });

  // Fetch initial unread count on mount
  useEffect(() => {
    if (userId) {
      fetchUnreadCount();
    }
  }, [userId]);

  // Handle when notifications are read
  const handleNotificationsRead = () => {
    setUnreadCount(0);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative text-white/90 hover:text-white hover:bg-white/10 transition-colors duration-200 rounded-lg p-2"
        data-testid="notification-bell-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute top-1 right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            data-testid="notification-count-badge"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
        <span className="sr-only">
          Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
        </span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute right-0 top-full mt-2 w-96 max-h-96 overflow-hidden z-[100] bg-background border border-border rounded-lg shadow-lg"
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            data-testid="notification-dropdown"
          >
            <NotificationList
              onNotificationsRead={handleNotificationsRead}
              onClose={() => setIsOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

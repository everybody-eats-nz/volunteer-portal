"use client";

import { useEffect, useRef, useState } from "react";

interface NotificationStreamEvent {
  type: "connected" | "heartbeat" | "notification" | "unread_count_changed" | "system_update";
  userId?: string;
  role?: "VOLUNTEER" | "ADMIN";
  timestamp?: number;
  data?: {
    count?: number;
    notification?: Record<string, unknown>;
    message?: string;
    [key: string]: unknown;
  };
}

interface UseNotificationStreamOptions {
  onUnreadCountChange?: (count: number) => void;
  onNewNotification?: (notification: Record<string, unknown>) => void;
  onSystemUpdate?: (message: string) => void;
  onConnectionStatusChange?: (connected: boolean) => void;
  enabled?: boolean;
  endpoint?: string; // Allow custom endpoint
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 2000;

export function useNotificationStream({
  onUnreadCountChange,
  onNewNotification,
  onSystemUpdate,
  onConnectionStatusChange,
  enabled = true,
  endpoint = "/api/notifications/stream",
}: UseNotificationStreamOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStats, setConnectionStats] = useState({
    connectedAt: null as Date | null,
    reconnectAttempts: 0,
    lastHeartbeat: null as Date | null,
  });

  // The latest callbacks, read by the long-lived EventSource handlers so a
  // new callback identity never tears down the connection.
  const callbacksRef = useRef({
    onUnreadCountChange,
    onNewNotification,
    onSystemUpdate,
    onConnectionStatusChange,
  });
  useEffect(() => {
    callbacksRef.current = {
      onUnreadCountChange,
      onNewNotification,
      onSystemUpdate,
      onConnectionStatusChange,
    };
  }, [onUnreadCountChange, onNewNotification, onSystemUpdate, onConnectionStatusChange]);

  // The connection belongs to this effect: opened when enabled, rebuilt when
  // the endpoint changes, and closed (with any pending reconnect) on cleanup.
  useEffect(() => {
    if (!enabled) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    const setConnected = (connected: boolean) => {
      setIsConnected(connected);
      callbacksRef.current.onConnectionStatusChange?.(connected);
    };

    const close = () => {
      eventSource?.close();
      eventSource = null;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    const connect = () => {
      close();

      try {
        console.log(`[SSE] Connecting to notification stream: ${endpoint}`);
        const source = new EventSource(endpoint);
        eventSource = source;

        source.onopen = () => {
          console.log("[SSE] Notification stream connected successfully");
          reconnectAttempts = 0;
          setConnectionStats((prev) => ({
            ...prev,
            connectedAt: new Date(),
            reconnectAttempts: 0,
          }));
          setConnected(true);
        };

        source.onmessage = (event) => {
          try {
            const data: NotificationStreamEvent = JSON.parse(event.data);

            // Update last heartbeat time
            if (data.type === "heartbeat") {
              setConnectionStats((prev) => ({
                ...prev,
                lastHeartbeat: new Date(),
              }));
            }

            switch (data.type) {
              case "connected":
                console.log(`[SSE] Connection established for user: ${data.userId} (${data.role})`);
                break;
              case "heartbeat":
                // Connection is alive, heartbeat logged above
                break;
              case "unread_count_changed":
                console.log(`[SSE] Unread count changed: ${data.data?.count}`);
                callbacksRef.current.onUnreadCountChange?.(data.data?.count || 0);
                break;
              case "notification":
                console.log("[SSE] New notification received");
                if (data.data?.notification) {
                  callbacksRef.current.onNewNotification?.(data.data.notification);
                }
                break;
              case "system_update":
                console.log(`[SSE] System update: ${data.data?.message}`);
                if (data.data?.message) {
                  callbacksRef.current.onSystemUpdate?.(data.data.message);
                }
                break;
              default:
                console.log(`[SSE] Unknown event type: ${data.type}`);
            }
          } catch (error) {
            console.error("[SSE] Error parsing message:", error);
          }
        };

        source.onerror = (error) => {
          // EventSource fires onerror on every transient drop and auto-reconnects
          // (handled below), so this is a warning, not an error — logging it at
          // error level pops the Next.js dev error overlay on every reconnect and
          // breaks e2e tests that assert on dialogs.
          console.warn("[SSE] Connection error:", error);
          setConnected(false);

          // Only attempt to reconnect if we haven't exceeded max attempts
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay =
              BASE_RECONNECT_DELAY_MS * Math.pow(2, Math.min(reconnectAttempts, 4));

            console.log(
              `[SSE] Reconnecting in ${delay}ms (attempt ${
                reconnectAttempts + 1
              }/${MAX_RECONNECT_ATTEMPTS})`
            );

            setConnectionStats((prev) => ({
              ...prev,
              reconnectAttempts: reconnectAttempts + 1,
            }));

            reconnectTimeout = setTimeout(() => {
              reconnectAttempts++;
              connect();
            }, delay);
          } else {
            console.error("[SSE] Max reconnection attempts reached. Connection abandoned.");
            close();
          }
        };
      } catch (error) {
        console.error("[SSE] Failed to create connection:", error);
        setConnected(false);
      }
    };

    connect();

    return () => {
      close();
      setConnected(false);
    };
  }, [enabled, endpoint]);

  return { isConnected, connectionStats };
}

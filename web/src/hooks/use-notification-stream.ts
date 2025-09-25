"use client";

import { useEffect, useRef, useCallback, useState } from "react";

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

export function useNotificationStream({
  onUnreadCountChange,
  onNewNotification,
  onSystemUpdate,
  onConnectionStatusChange,
  enabled = true,
  endpoint = "/api/notifications/stream",
}: UseNotificationStreamOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStats, setConnectionStats] = useState({
    connectedAt: null as Date | null,
    reconnectAttempts: 0,
    lastHeartbeat: null as Date | null,
  });

  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 2000; // 2 seconds (increased from 1s)

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    onConnectionStatusChange?.(false);
  }, [onConnectionStatusChange]);

  const connect = useCallback(() => {
    if (!enabled) return;

    cleanup();

    try {
      console.log(`[SSE] Connecting to notification stream: ${endpoint}`);
      const eventSource = new EventSource(endpoint);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("[SSE] Notification stream connected successfully");
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
        setConnectionStats(prev => ({
          ...prev,
          connectedAt: new Date(),
          reconnectAttempts: 0,
        }));
        onConnectionStatusChange?.(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data: NotificationStreamEvent = JSON.parse(event.data);

          // Update last heartbeat time
          if (data.type === "heartbeat") {
            setConnectionStats(prev => ({
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
              onUnreadCountChange?.(data.data?.count || 0);
              break;
            case "notification":
              console.log("[SSE] New notification received");
              if (data.data?.notification) {
                onNewNotification?.(data.data.notification);
              }
              break;
            case "system_update":
              console.log(`[SSE] System update: ${data.data?.message}`);
              if (data.data?.message) {
                onSystemUpdate?.(data.data.message);
              }
              break;
            default:
              console.log(`[SSE] Unknown event type: ${data.type}`);
          }
        } catch (error) {
          console.error("[SSE] Error parsing message:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("[SSE] Connection error:", error);
        setIsConnected(false);
        onConnectionStatusChange?.(false);

        // Only attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts && enabled) {
          const delay = baseReconnectDelay * Math.pow(2, Math.min(reconnectAttemptsRef.current, 4));

          console.log(
            `[SSE] Reconnecting in ${delay}ms (attempt ${
              reconnectAttemptsRef.current + 1
            }/${maxReconnectAttempts})`
          );

          setConnectionStats(prev => ({
            ...prev,
            reconnectAttempts: reconnectAttemptsRef.current + 1,
          }));

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          console.error("[SSE] Max reconnection attempts reached. Connection abandoned.");
          cleanup();
        }
      };
    } catch (error) {
      console.error("[SSE] Failed to create connection:", error);
      setIsConnected(false);
      onConnectionStatusChange?.(false);
    }
  }, [enabled, endpoint, onUnreadCountChange, onNewNotification, onSystemUpdate, onConnectionStatusChange, cleanup]);

  // Initialize connection
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      cleanup();
    }

    return cleanup;
  }, [enabled, connect, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    reconnect: connect,
    disconnect: cleanup,
    isConnected,
    connectionStats,
    forceReconnect: useCallback(() => {
      reconnectAttemptsRef.current = 0; // Reset attempts
      connect();
    }, [connect]),
  };
}

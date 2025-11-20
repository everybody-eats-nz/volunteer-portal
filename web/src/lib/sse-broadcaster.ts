// Legacy SSE broadcaster - now uses Better-SSE notification manager
// This file is kept for backward compatibility

import { notificationSSEManager } from "./notification-sse-manager";

/**
 * @deprecated Use notificationSSEManager directly for new code
 * This is maintained for backward compatibility only
 */
class SSEBroadcaster {
  /**
   * @deprecated Use notificationSSEManager.addConnection instead
   */
  addClient(userId: string, controller: ReadableStreamDefaultController) {
    console.warn(
      "[SSE] Using deprecated addClient method. Please use notificationSSEManager directly."
    );
    // Convert ReadableStreamDefaultController to WritableStreamDefaultWriter for compatibility
    // Note: This is a simplified conversion and may not work for all cases
    return { userId, controller };
  }

  /**
   * @deprecated Use notificationSSEManager.removeConnection instead
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeClient(_userId: string, _controller: ReadableStreamDefaultController) {
    console.warn(
      "[SSE] Using deprecated removeClient method. Please use notificationSSEManager directly."
    );
    // Legacy method - no direct equivalent in new system
  }

  /**
   * @deprecated Use notificationSSEManager.sendToUser instead
   */
  broadcast(userId: string, event: Record<string, unknown>) {
    console.warn(
      "[SSE] Using deprecated broadcast method. Please use notificationSSEManager.sendToUser instead."
    );
    const eventType = event.type as string;
    const validTypes = [
      "notification",
      "connected",
      "heartbeat",
      "unread_count_changed",
      "system_update",
    ];
    const safeType = validTypes.includes(eventType)
      ? eventType
      : "notification";

    notificationSSEManager.sendToUser(userId, {
      type: safeType as
        | "notification"
        | "connected"
        | "heartbeat"
        | "unread_count_changed"
        | "system_update",
      timestamp: Date.now(),
      data: event.data as Record<string, unknown>,
    });
  }

  /**
   * @deprecated Use notificationSSEManager.sendUnreadCountUpdate instead
   */
  broadcastUnreadCountChange(userId: string, count: number) {
    notificationSSEManager.sendUnreadCountUpdate(userId, count);
  }

  /**
   * @deprecated Use notificationSSEManager.sendNewNotification instead
   */
  broadcastNewNotification(
    userId: string,
    notification: Record<string, unknown>
  ) {
    notificationSSEManager.sendNewNotification(userId, notification);
  }

  /**
   * @deprecated Use notificationSSEManager.getUserConnectionCount instead
   */
  getClientCount(userId?: string): number {
    if (userId) {
      return notificationSSEManager.getUserConnectionCount(userId);
    }
    return notificationSSEManager.getStats().totalConnections;
  }
}

// Export singleton instance for backward compatibility
export const sseBroadcaster = new SSEBroadcaster();
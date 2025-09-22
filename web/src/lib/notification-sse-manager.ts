/**
 * Better-SSE based notification manager for real-time notifications
 * Supports both volunteers and admins with proper session management
 */

interface NotificationEvent {
  type: "connected" | "heartbeat" | "notification" | "unread_count_changed" | "system_update";
  userId?: string;
  timestamp: number;
  data?: {
    count?: number;
    notification?: Record<string, unknown>;
    message?: string;
    [key: string]: unknown;
  };
}

interface SSEConnection {
  userId: string;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  connectedAt: number;
  role?: "VOLUNTEER" | "ADMIN";
}

class NotificationSSEManager {
  private connections = new Map<string, SSEConnection[]>();
  private encoder = new TextEncoder();

  /**
   * Add a new SSE connection for a user
   */
  addConnection(
    userId: string,
    writer: WritableStreamDefaultWriter<Uint8Array>,
    role?: "VOLUNTEER" | "ADMIN"
  ): void {
    const connection: SSEConnection = {
      userId,
      writer,
      encoder: new TextEncoder(),
      connectedAt: Date.now(),
      role,
    };

    const userConnections = this.connections.get(userId) || [];
    userConnections.push(connection);
    this.connections.set(userId, userConnections);

    console.log(
      `[SSE] Added connection for user ${userId} (${role || "unknown role"}). Total connections: ${userConnections.length}`
    );
  }

  /**
   * Remove an SSE connection for a user
   */
  removeConnection(
    userId: string,
    writer: WritableStreamDefaultWriter<Uint8Array>
  ): void {
    const userConnections = this.connections.get(userId) || [];
    const updatedConnections = userConnections.filter(
      (conn) => conn.writer !== writer
    );

    if (updatedConnections.length === 0) {
      this.connections.delete(userId);
    } else {
      this.connections.set(userId, updatedConnections);
    }

    console.log(
      `[SSE] Removed connection for user ${userId}. Remaining connections: ${updatedConnections.length}`
    );
  }

  /**
   * Send a notification event to a specific user
   */
  async sendToUser(userId: string, event: NotificationEvent): Promise<boolean> {
    const userConnections = this.connections.get(userId) || [];

    if (userConnections.length === 0) {
      console.log(`[SSE] No active connections for user ${userId}`);
      return false;
    }

    const message = `data: ${JSON.stringify({
      ...event,
      timestamp: Date.now(),
    })}\n\n`;

    let successCount = 0;
    const deadConnections: SSEConnection[] = [];

    for (const connection of userConnections) {
      try {
        await connection.writer.write(connection.encoder.encode(message));
        successCount++;
      } catch (error) {
        console.error(
          `[SSE] Failed to send to user ${userId}:`,
          error
        );
        deadConnections.push(connection);
      }
    }

    // Remove dead connections
    if (deadConnections.length > 0) {
      const aliveConnections = userConnections.filter(
        (conn) => !deadConnections.includes(conn)
      );

      if (aliveConnections.length === 0) {
        this.connections.delete(userId);
      } else {
        this.connections.set(userId, aliveConnections);
      }

      console.log(
        `[SSE] Removed ${deadConnections.length} dead connections for user ${userId}`
      );
    }

    console.log(
      `[SSE] Sent ${event.type} to ${successCount}/${userConnections.length} connections for user ${userId}`
    );

    return successCount > 0;
  }

  /**
   * Broadcast to all admin users
   */
  async broadcastToAdmins(event: NotificationEvent): Promise<number> {
    let totalSent = 0;

    for (const [userId, connections] of this.connections) {
      const adminConnections = connections.filter(
        (conn) => conn.role === "ADMIN"
      );

      if (adminConnections.length > 0) {
        const success = await this.sendToUser(userId, event);
        if (success) totalSent++;
      }
    }

    console.log(`[SSE] Broadcast ${event.type} to ${totalSent} admin users`);
    return totalSent;
  }

  /**
   * Broadcast to all volunteer users
   */
  async broadcastToVolunteers(event: NotificationEvent): Promise<number> {
    let totalSent = 0;

    for (const [userId, connections] of this.connections) {
      const volunteerConnections = connections.filter(
        (conn) => conn.role === "VOLUNTEER"
      );

      if (volunteerConnections.length > 0) {
        const success = await this.sendToUser(userId, event);
        if (success) totalSent++;
      }
    }

    console.log(`[SSE] Broadcast ${event.type} to ${totalSent} volunteer users`);
    return totalSent;
  }

  /**
   * Broadcast to all connected users
   */
  async broadcastToAll(event: NotificationEvent): Promise<number> {
    let totalSent = 0;

    for (const userId of this.connections.keys()) {
      const success = await this.sendToUser(userId, event);
      if (success) totalSent++;
    }

    console.log(`[SSE] Broadcast ${event.type} to ${totalSent} users`);
    return totalSent;
  }

  /**
   * Send unread count update to a specific user
   */
  async sendUnreadCountUpdate(userId: string, count: number): Promise<boolean> {
    return this.sendToUser(userId, {
      type: "unread_count_changed",
      timestamp: Date.now(),
      data: { count },
    });
  }

  /**
   * Send new notification to a specific user
   */
  async sendNewNotification(
    userId: string,
    notification: Record<string, unknown>
  ): Promise<boolean> {
    return this.sendToUser(userId, {
      type: "notification",
      timestamp: Date.now(),
      data: { notification },
    });
  }

  /**
   * Send system update to admins
   */
  async sendSystemUpdateToAdmins(message: string): Promise<number> {
    return this.broadcastToAdmins({
      type: "system_update",
      timestamp: Date.now(),
      data: { message },
    });
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalUsers: number;
    totalConnections: number;
    adminConnections: number;
    volunteerConnections: number;
  } {
    let totalConnections = 0;
    let adminConnections = 0;
    let volunteerConnections = 0;

    for (const connections of this.connections.values()) {
      totalConnections += connections.length;
      for (const conn of connections) {
        if (conn.role === "ADMIN") adminConnections++;
        else if (conn.role === "VOLUNTEER") volunteerConnections++;
      }
    }

    return {
      totalUsers: this.connections.size,
      totalConnections,
      adminConnections,
      volunteerConnections,
    };
  }

  /**
   * Get active connections for a specific user
   */
  getUserConnectionCount(userId: string): number {
    return this.connections.get(userId)?.length || 0;
  }

  /**
   * Close all connections (for cleanup)
   */
  async closeAllConnections(): Promise<void> {
    for (const [userId, connections] of this.connections) {
      for (const connection of connections) {
        try {
          await connection.writer.close();
        } catch (error) {
          console.error(`Error closing connection for user ${userId}:`, error);
        }
      }
    }
    this.connections.clear();
    console.log("[SSE] All notification connections closed");
  }
}

// Export singleton instance
export const notificationSSEManager = new NotificationSSEManager();
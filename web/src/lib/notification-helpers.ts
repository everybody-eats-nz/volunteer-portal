/**
 * Helper functions for sending notifications via Better-SSE
 * Supports both volunteers and admins with role-based broadcasting
 */

import { notificationSSEManager } from "./notification-sse-manager";

export interface NotificationPayload {
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SystemUpdatePayload {
  message: string;
  type?: "maintenance" | "feature" | "announcement" | "alert";
  severity?: "low" | "medium" | "high" | "critical";
  actionRequired?: boolean;
}

/**
 * Send a notification to a specific user
 */
export async function sendNotificationToUser(
  userId: string,
  notification: NotificationPayload
): Promise<boolean> {
  console.log(`[NOTIFICATIONS] Sending notification to user ${userId}:`, notification.title);

  return notificationSSEManager.sendNewNotification(userId, {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...notification,
    timestamp: Date.now(),
    read: false,
  });
}

/**
 * Update unread notification count for a user
 */
export async function updateUnreadCount(
  userId: string,
  count: number
): Promise<boolean> {
  console.log(`[NOTIFICATIONS] Updating unread count for user ${userId}: ${count}`);

  return notificationSSEManager.sendUnreadCountUpdate(userId, count);
}

/**
 * Send a system update to all admin users
 */
export async function sendSystemUpdateToAdmins(
  update: SystemUpdatePayload
): Promise<number> {
  console.log(`[NOTIFICATIONS] Broadcasting system update to admins:`, update.message);

  const enrichedUpdate = {
    id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...update,
    timestamp: Date.now(),
  };

  return notificationSSEManager.sendSystemUpdateToAdmins(JSON.stringify(enrichedUpdate));
}

/**
 * Send a shift-related notification to volunteers
 */
export async function sendShiftNotificationToVolunteers(
  shiftId: string,
  notification: NotificationPayload
): Promise<number> {
  console.log(`[NOTIFICATIONS] Broadcasting shift notification to volunteers:`, notification.title);

  const enrichedNotification = {
    id: `shift-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...notification,
    metadata: {
      ...notification.metadata,
      shiftId,
      category: "shift",
    },
    timestamp: Date.now(),
    read: false,
  };

  return notificationSSEManager.broadcastToVolunteers({
    type: "notification",
    timestamp: Date.now(),
    data: { notification: enrichedNotification },
  });
}

/**
 * Send migration completion notification to admins
 */
export async function notifyAdminsMigrationComplete(
  migrationDetails: {
    type: "bulk" | "single";
    usersProcessed: number;
    usersCreated: number;
    errors: number;
    duration: number;
  }
): Promise<number> {
  const { type, usersCreated, errors, duration } = migrationDetails;

  const message = `${type === "bulk" ? "Bulk" : "Single"} migration completed: ${usersCreated} users migrated${
    errors > 0 ? ` (${errors} errors)` : ""
  } in ${(duration / 1000).toFixed(1)}s`;

  return sendSystemUpdateToAdmins({
    message,
    type: "feature",
    severity: errors > 0 ? "medium" : "low",
    actionRequired: errors > 0,
  });
}

/**
 * Send notification when a new volunteer registers
 */
export async function notifyAdminsNewVolunteer(
  volunteerData: {
    id: string;
    name: string;
    email: string;
    registrationMethod?: string;
  }
): Promise<number> {
  const { name, email, registrationMethod } = volunteerData;

  const message = `New volunteer registered: ${name} (${email})${
    registrationMethod ? ` via ${registrationMethod}` : ""
  }`;

  return sendSystemUpdateToAdmins({
    message,
    type: "announcement",
    severity: "low",
    actionRequired: false,
  });
}

/**
 * Send urgent notification to all users
 */
export async function sendUrgentNotificationToAll(
  notification: NotificationPayload & { urgent: true }
): Promise<number> {
  console.log(`[NOTIFICATIONS] Broadcasting urgent notification to all users:`, notification.title);

  const enrichedNotification = {
    id: `urgent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...notification,
    timestamp: Date.now(),
    read: false,
    urgent: true,
  };

  return notificationSSEManager.broadcastToAll({
    type: "notification",
    timestamp: Date.now(),
    data: { notification: enrichedNotification },
  });
}

/**
 * Get notification system statistics
 */
export function getNotificationStats() {
  return notificationSSEManager.getStats();
}

/**
 * Check if a user has active notification connections
 */
export function isUserConnected(userId: string): boolean {
  return notificationSSEManager.getUserConnectionCount(userId) > 0;
}


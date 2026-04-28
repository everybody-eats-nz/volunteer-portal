import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/generated/client";
import {
  isUserConnected,
  sendNotificationToUser,
  updateUnreadCount,
} from "./notification-helpers";
import { sendPushToUser, sendPushToUsers } from "./services/expo-push";

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  relatedId?: string;
}

/**
 * Create a new notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
        relatedId: params.relatedId,
      },
    });

    // Send notification via Better-SSE (fire-and-forget to avoid blocking the
    // response if the SSE writer hangs due to backpressure or stale connections)
    sendNotificationToUser(params.userId, {
      title: params.title,
      message: params.message,
      type: "info",
      actionUrl: params.actionUrl,
      metadata: {
        notificationId: notification.id,
        type: params.type,
        relatedId: params.relatedId,
        createdAt: notification.createdAt,
      },
    }).catch((err) => console.error("Error sending SSE notification:", err));

    // Update unread count (fire-and-forget)
    getUnreadNotificationCount(params.userId)
      .then((unreadCount) => {
        updateUnreadCount(params.userId, unreadCount).catch((err) =>
          console.error("Error sending SSE unread count update:", err)
        );
        // Dispatch to mobile push in parallel. The badge count is the current
        // unread total so the app icon stays in sync with the in-app inbox.
        sendPushToUser(params.userId, {
          title: params.title,
          body: params.message,
          badge: unreadCount,
          data: {
            notificationId: notification.id,
            type: params.type,
            relatedId: params.relatedId,
            actionUrl: params.actionUrl,
          },
        }).catch((err) =>
          console.error("Error sending push notification:", err)
        );
      })
      .catch((err) => console.error("Error computing unread count:", err));

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

export interface CreateNotificationsForUsersParams {
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  relatedId?: string;
}

/**
 * Create the same notification for many users in one go. Uses a single
 * `createMany` for the database inserts, a single batched Expo push call
 * (with per-user badge counts), and per-user SSE fan-out in parallel.
 *
 * Caller is responsible for filtering `userIds` by any per-user opt-in flags.
 */
export async function createNotificationsForUsers(
  params: CreateNotificationsForUsersParams
) {
  const userIds = Array.from(new Set(params.userIds));
  if (userIds.length === 0) return { count: 0 };

  try {
    const result = await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
        relatedId: params.relatedId,
      })),
    });

    // Fan out SSE + push. All fire-and-forget so the admin request returns
    // quickly even if a subset of SSE writers hang on backpressure.
    const unreadCounts = await prisma.notification.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, isRead: false },
      _count: { _all: true },
    });
    const badgeByUserId = new Map(
      unreadCounts.map((row) => [row.userId, row._count._all])
    );

    // Skip SSE for users with no active connection — this is a cheap
    // in-memory check that avoids per-user log spam when most recipients
    // aren't online (e.g. an admin sending a shortage blast at 2am).
    for (const userId of userIds) {
      if (!isUserConnected(userId)) continue;
      const unreadCount = badgeByUserId.get(userId) ?? 0;
      sendNotificationToUser(userId, {
        title: params.title,
        message: params.message,
        type: "info",
        actionUrl: params.actionUrl,
        metadata: {
          type: params.type,
          relatedId: params.relatedId,
        },
      }).catch((err) => console.error("Error sending SSE notification:", err));
      updateUnreadCount(userId, unreadCount).catch((err) =>
        console.error("Error sending SSE unread count update:", err)
      );
    }

    sendPushToUsers(
      userIds,
      {
        title: params.title,
        body: params.message,
        data: {
          type: params.type,
          relatedId: params.relatedId,
          actionUrl: params.actionUrl,
        },
      },
      badgeByUserId
    ).catch((err) => console.error("Error sending batched push:", err));

    return result;
  } catch (error) {
    console.error("Error creating batched notifications:", error);
    throw error;
  }
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(userId: string) {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return notifications;
  } catch (error) {
    console.error("Error fetching unread notifications:", error);
    throw error;
  }
}

/**
 * Get all notifications for a user (paginated)
 */
export async function getNotifications(
  userId: string,
  limit: number = 20,
  offset: number = 0
) {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    const totalCount = await prisma.notification.count({
      where: {
        userId,
      },
    });

    return {
      notifications,
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
) {
  try {
    const notification = await prisma.notification.update({
      where: {
        id: notificationId,
        userId, // Ensure user owns the notification
      },
      data: {
        isRead: true,
      },
    });

    // Update unread count via Better-SSE (fire-and-forget to avoid blocking the response
    // if the SSE writer hangs due to backpressure or stale connections)
    getUnreadNotificationCount(userId)
      .then((unreadCount) => updateUnreadCount(userId, unreadCount))
      .catch((err) => console.error("Error sending SSE unread count update:", err));

    return notification;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    // Update unread count via Better-SSE (fire-and-forget to avoid blocking the response
    // if the SSE writer hangs due to backpressure or stale connections)
    updateUnreadCount(userId, 0).catch((err) =>
      console.error("Error sending SSE unread count update:", err)
    );

    return result;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
) {
  try {
    const notification = await prisma.notification.delete({
      where: {
        id: notificationId,
        userId, // Ensure user owns the notification
      },
    });

    return notification;
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: string) {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return count;
  } catch (error) {
    console.error("Error fetching unread notification count:", error);
    throw error;
  }
}

// Notification creators for specific events

/**
 * Create a friend request received notification
 */
export async function createFriendRequestNotification(
  recipientUserId: string,
  senderName: string,
  friendRequestId: string,
  senderUserId?: string
) {
  const actionUrl = senderUserId
    ? `/friends?tab=requests&fromUserId=${senderUserId}`
    : "/friends?tab=requests";

  return createNotification({
    userId: recipientUserId,
    type: "FRIEND_REQUEST_RECEIVED",
    title: "New friend request",
    message: `${senderName} sent you a friend request`,
    actionUrl,
    relatedId: friendRequestId,
  });
}

/**
 * Create a friend request accepted notification
 */
export async function createFriendRequestAcceptedNotification(
  recipientUserId: string,
  accepterName: string,
  friendshipId: string,
  accepterUserId?: string
) {
  const actionUrl = accepterUserId
    ? `/friends/${accepterUserId}`
    : "/friends";

  return createNotification({
    userId: recipientUserId,
    type: "FRIEND_REQUEST_ACCEPTED",
    title: "Friend request accepted",
    message: `${accepterName} accepted your friend request`,
    actionUrl,
    relatedId: friendshipId,
  });
}

/**
 * Create a shift confirmed notification
 */
export async function createShiftConfirmedNotification(
  userId: string,
  shiftName: string,
  shiftDate: string,
  shiftId: string
) {
  return createNotification({
    userId,
    type: "SHIFT_CONFIRMED",
    title: "Shift confirmed",
    message: `Your ${shiftName} shift on ${shiftDate} has been confirmed`,
    actionUrl: `/shifts/${shiftId}`,
    relatedId: shiftId,
  });
}

/**
 * Create a shift waitlisted notification
 */
export async function createShiftWaitlistedNotification(
  userId: string,
  shiftName: string,
  shiftDate: string,
  shiftId: string
) {
  return createNotification({
    userId,
    type: "SHIFT_WAITLISTED",
    title: "Added to waitlist",
    message: `You've been added to the waitlist for ${shiftName} on ${shiftDate}`,
    actionUrl: "/shifts/mine",
    relatedId: shiftId,
  });
}

/**
 * Create a shift canceled notification
 */
export async function createShiftCanceledNotification(
  userId: string,
  shiftName: string,
  shiftDate: string,
  shiftId: string
) {
  return createNotification({
    userId,
    type: "SHIFT_CANCELED",
    title: "Shift canceled",
    message: `Your ${shiftName} shift on ${shiftDate} has been canceled by an administrator`,
    actionUrl: `/shifts/${shiftId}`,
    relatedId: shiftId,
  });
}

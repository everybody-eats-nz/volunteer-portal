import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
} from "@/lib/notifications";

/**
 * Rewrite friend-notification actionUrls to include the other user's id, so
 * the mobile app can route straight to their profile. Handles notifications
 * created before we started embedding the id in the URL — we resolve it from
 * `relatedId` (a FriendRequest or Friendship id) at read time.
 */
async function enrichFriendActionUrls(
  notifications: {
    id: string;
    type: string;
    actionUrl: string | null;
    relatedId: string | null;
  }[],
  viewerId: string
): Promise<Map<string, string>> {
  const patched = new Map<string, string>();

  const requestIds = notifications
    .filter(
      (n) =>
        n.type === "FRIEND_REQUEST_RECEIVED" &&
        n.relatedId &&
        !n.actionUrl?.includes("fromUserId=")
    )
    .map((n) => n.relatedId!);

  const friendshipIds = notifications
    .filter(
      (n) =>
        n.type === "FRIEND_REQUEST_ACCEPTED" &&
        n.relatedId &&
        !/^\/friends\/[^?]+/.test(n.actionUrl ?? "")
    )
    .map((n) => n.relatedId!);

  const [requests, friendships] = await Promise.all([
    requestIds.length
      ? prisma.friendRequest.findMany({
          where: { id: { in: requestIds } },
          select: { id: true, fromUserId: true },
        })
      : Promise.resolve([]),
    friendshipIds.length
      ? prisma.friendship.findMany({
          where: { id: { in: friendshipIds } },
          select: { id: true, userId: true, friendId: true },
        })
      : Promise.resolve([]),
  ]);

  const requestById = new Map(requests.map((r) => [r.id, r.fromUserId]));
  const otherUserByFriendship = new Map(
    friendships.map((f) => [
      f.id,
      f.userId === viewerId ? f.friendId : f.userId,
    ])
  );

  for (const n of notifications) {
    if (!n.relatedId) continue;
    if (n.type === "FRIEND_REQUEST_RECEIVED") {
      const fromUserId = requestById.get(n.relatedId);
      if (fromUserId) {
        patched.set(
          n.id,
          `/friends?tab=requests&fromUserId=${fromUserId}`
        );
      }
    } else if (n.type === "FRIEND_REQUEST_ACCEPTED") {
      const otherUserId = otherUserByFriendship.get(n.relatedId);
      if (otherUserId) {
        patched.set(n.id, `/friends/${otherUserId}`);
      }
    }
  }

  return patched;
}

/**
 * GET /api/mobile/notifications?limit=20&offset=0
 *
 * Returns a paginated list of notifications for the authenticated mobile user
 * plus the current unread count (used to drive badges without a second call).
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1),
      100
    );
    const offset = Math.max(
      parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
      0
    );

    const [list, unreadCount] = await Promise.all([
      getNotifications(auth.userId, limit, offset),
      getUnreadNotificationCount(auth.userId),
    ]);

    const patchedUrls = await enrichFriendActionUrls(
      list.notifications,
      auth.userId
    );

    return NextResponse.json({
      notifications: list.notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        actionUrl: patchedUrls.get(n.id) ?? n.actionUrl,
        relatedId: n.relatedId,
        createdAt: n.createdAt.toISOString(),
      })),
      totalCount: list.totalCount,
      hasMore: list.hasMore,
      unreadCount,
    });
  } catch (error) {
    console.error("Mobile notifications list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/mobile/notifications
 *
 * Mark all notifications as read. Body: { action: "mark_all_read" }.
 */
export async function PUT(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "mark_all_read") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const result = await markAllNotificationsAsRead(auth.userId);
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Mobile notifications mark-all-read error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

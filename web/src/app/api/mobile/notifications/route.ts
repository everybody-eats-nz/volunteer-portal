import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
} from "@/lib/notifications";

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

    return NextResponse.json({
      notifications: list.notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        actionUrl: n.actionUrl,
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

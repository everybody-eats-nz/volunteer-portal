import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  sendTestNotification,
  sendSystemUpdateToAdmins,
  getNotificationStats,
} from "@/lib/notification-helpers";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { type = "user", targetUserId } = body;

    switch (type) {
      case "user":
        if (!targetUserId) {
          return NextResponse.json(
            { error: "targetUserId required for user test" },
            { status: 400 }
          );
        }

        const success = await sendTestNotification(
          targetUserId,
          session.user.role as "VOLUNTEER" | "ADMIN"
        );

        return NextResponse.json({
          success,
          message: success
            ? `Test notification sent to user ${targetUserId}`
            : `Failed to send notification to user ${targetUserId}`,
        });

      case "admin_broadcast":
        const adminCount = await sendSystemUpdateToAdmins({
          message: "This is a test system update broadcast to all admins",
          type: "feature",
          severity: "low",
          actionRequired: false,
        });

        return NextResponse.json({
          success: adminCount > 0,
          adminCount,
          message: `System update sent to ${adminCount} admin(s)`,
        });

      case "stats":
        const stats = getNotificationStats();

        return NextResponse.json({
          success: true,
          stats,
          message: "Notification system statistics retrieved",
        });

      default:
        return NextResponse.json(
          { error: `Unknown test type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Notification test error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const stats = getNotificationStats();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Notification stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
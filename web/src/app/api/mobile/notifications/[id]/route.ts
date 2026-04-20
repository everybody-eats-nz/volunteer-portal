import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import {
  deleteNotification,
  markNotificationAsRead,
} from "@/lib/notifications";

/**
 * PUT /api/mobile/notifications/:id
 *
 * Mark a single notification as read. Body: { action: "mark_read" }.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (body?.action !== "mark_read") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const notification = await markNotificationAsRead(id, auth.userId);
    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("Mobile notification mark-read error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mobile/notifications/:id
 *
 * Delete a notification owned by the authenticated user.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deleteNotification(id, auth.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mobile notification delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

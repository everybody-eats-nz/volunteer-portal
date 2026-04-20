import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { createFriendRequestNotification } from "@/lib/notifications";

/**
 * POST /api/mobile/users/[id]/friend-request
 *
 * Sends a friend request to a user (by user ID) from the mobile app.
 * Uses the same FriendRequest row that the web app does, so the existing
 * accept/decline flow works across both clients.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { id: targetId } = await params;

  if (!targetId || targetId === userId) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const [me, target] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, firstName: true, lastName: true },
    }),
    prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        email: true,
        allowFriendRequests: true,
      },
    }),
  ]);

  if (!me || !target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!target.allowFriendRequests) {
    return NextResponse.json(
      { error: "This user is not accepting friend requests" },
      { status: 400 }
    );
  }

  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId, friendId: targetId },
        { userId: targetId, friendId: userId },
      ],
    },
  });

  if (existingFriendship) {
    return NextResponse.json(
      { error: "Already friends or a request is pending" },
      { status: 400 }
    );
  }

  const existing = await prisma.friendRequest.findFirst({
    where: { fromUserId: userId, toEmail: target.email },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  if (
    existing &&
    existing.status === "PENDING" &&
    existing.expiresAt > new Date()
  ) {
    return NextResponse.json({ ok: true, status: "REQUEST_SENT" });
  }

  const friendRequest = existing
    ? await prisma.friendRequest.update({
        where: { id: existing.id },
        data: {
          status: "PENDING",
          expiresAt,
          updatedAt: new Date(),
        },
      })
    : await prisma.friendRequest.create({
        data: {
          fromUserId: userId,
          toEmail: target.email,
          expiresAt,
        },
      });

  // Notify the target (non-blocking)
  try {
    const senderName =
      me.name ??
      ([me.firstName, me.lastName].filter(Boolean).join(" ") || me.email);
    await createFriendRequestNotification(target.id, senderName, friendRequest.id);
  } catch (err) {
    console.error("[friend-request] Notification failed:", err);
  }

  return NextResponse.json({ ok: true, status: "REQUEST_SENT" });
}

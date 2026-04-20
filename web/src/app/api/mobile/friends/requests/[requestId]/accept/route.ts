import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { createFriendRequestAcceptedNotification } from "@/lib/notifications";

/**
 * POST /api/mobile/friends/requests/[requestId]/accept
 *
 * Mobile equivalent of /api/friends/requests/[requestId]/accept. Authenticates
 * via the mobile JWT, verifies the request belongs to the caller, creates the
 * bidirectional friendship, and notifies the original requester.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { requestId } = await params;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!me) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const friendRequest = await prisma.friendRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      fromUserId: true,
      toEmail: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!friendRequest) {
    return NextResponse.json(
      { error: "Friend request not found" },
      { status: 404 }
    );
  }

  if (friendRequest.toEmail !== me.email) {
    return NextResponse.json(
      { error: "Unauthorized to accept this request" },
      { status: 403 }
    );
  }

  if (
    friendRequest.status !== "PENDING" ||
    friendRequest.expiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: "Friend request is no longer valid" },
      { status: 400 }
    );
  }

  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: me.id, friendId: friendRequest.fromUserId },
        { userId: friendRequest.fromUserId, friendId: me.id },
      ],
    },
  });

  if (existingFriendship) {
    return NextResponse.json(
      { error: "Friendship already exists" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.friendRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
    });

    const friendship1 = await tx.friendship.create({
      data: {
        userId: me.id,
        friendId: friendRequest.fromUserId,
        status: "ACCEPTED",
        initiatedBy: friendRequest.fromUserId,
      },
    });

    const friendship2 = await tx.friendship.create({
      data: {
        userId: friendRequest.fromUserId,
        friendId: me.id,
        status: "ACCEPTED",
        initiatedBy: friendRequest.fromUserId,
      },
    });

    return { friendship1, friendship2 };
  });

  try {
    const accepterName =
      me.name ??
      ([me.firstName, me.lastName].filter(Boolean).join(" ") || me.email);
    await createFriendRequestAcceptedNotification(
      friendRequest.fromUserId,
      accepterName,
      result.friendship1.id,
      me.id
    );
  } catch (err) {
    console.error("[mobile/accept] Notification failed:", err);
  }

  return NextResponse.json({ ok: true, status: "FRIENDS" });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createFriendRequestAcceptedNotification } from "@/lib/notifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const { requestId } = await params;

    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        fromUser: {
          select: { id: true, email: true, name: true, firstName: true, lastName: true },
        },
      },
    });

    if (!friendRequest) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    // Verify this request is for the current user
    if (friendRequest.toEmail !== user.email) {
      return NextResponse.json(
        { error: "Unauthorized to accept this request" },
        { status: 403 }
      );
    }

    // Check if request is still valid
    if (friendRequest.status !== "PENDING" || friendRequest.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Friend request is no longer valid" },
        { status: 400 }
      );
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId: friendRequest.fromUserId },
          { userId: friendRequest.fromUserId, friendId: user.id },
        ],
      },
    });

    if (existingFriendship) {
      return NextResponse.json(
        { error: "Friendship already exists" },
        { status: 400 }
      );
    }

    // Create bidirectional friendship in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update friend request status
      await tx.friendRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      });

      // Create bidirectional friendship
      const friendship1 = await tx.friendship.create({
        data: {
          userId: user.id,
          friendId: friendRequest.fromUserId,
          status: "ACCEPTED",
          initiatedBy: friendRequest.fromUserId,
        },
      });

      const friendship2 = await tx.friendship.create({
        data: {
          userId: friendRequest.fromUserId,
          friendId: user.id,
          status: "ACCEPTED",
          initiatedBy: friendRequest.fromUserId,
        },
      });

      return { friendship1, friendship2 };
    });

    // Create notification for the requester about acceptance
    try {
      const accepterName = user.name || 
        (user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`
          : user.email);

      await createFriendRequestAcceptedNotification(
        friendRequest.fromUserId,
        accepterName,
        result.friendship1.id
      );
    } catch (notificationError) {
      // Don't fail the acceptance if notification creation fails
      console.error("Error creating friend request accepted notification:", notificationError);
    }

    return NextResponse.json({
      message: "Friend request accepted",
      friendship: result.friendship1,
    });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
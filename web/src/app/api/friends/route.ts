import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { friendRequestLimiter, getClientIdentifier } from "@/lib/rate-limit";
import { createFriendRequestNotification } from "@/lib/notifications";

const sendFriendRequestSchema = z.object({
  email: z.string().email("Invalid email format"),
  message: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    // Get user's friends using a more efficient query that avoids N+1 issues
    // We'll use raw query for better performance with deduplication at database level
    const friendsRaw = await prisma.$queryRaw<Array<{
      friendshipId: string;
      friendId: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      email: string;
      profilePhotoUrl: string | null;
      friendsSince: Date;
    }>>`
      SELECT DISTINCT
        f.id as "friendshipId",
        u.id as "friendId",
        u.name,
        u."firstName",
        u."lastName", 
        u.email,
        u."profilePhotoUrl",
        f."createdAt" as "friendsSince"
      FROM "Friendship" f
      JOIN "User" u ON (
        (f."userId" = ${user.id} AND u.id = f."friendId") OR
        (f."friendId" = ${user.id} AND u.id = f."userId")
      )
      WHERE f.status = 'ACCEPTED' AND u.id != ${user.id}
      ORDER BY f."createdAt" ASC
    `;

    // Get pending friend requests received
    const pendingRequests = await prisma.friendRequest.findMany({
      where: {
        toEmail: user.email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePhotoUrl: true,
          },
        },
      },
    });

    // Get sent friend requests
    const sentRequests = await prisma.friendRequest.findMany({
      where: {
        fromUserId: user.id,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    // Format friends list - the query already handles deduplication and proper joins
    const formattedFriends = friendsRaw.map(friend => ({
      friendshipId: friend.friendshipId,
      id: friend.friendId,
      name: friend.name,
      firstName: friend.firstName,
      lastName: friend.lastName,
      email: friend.email,
      profilePhotoUrl: friend.profilePhotoUrl,
      friendsSince: friend.friendsSince,
    }));

    return NextResponse.json({
      friends: formattedFriends,
      pendingRequests,
      sentRequests,
    });
  } catch (error) {
    console.error("Error fetching friends:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Apply rate limiting
  const clientId = getClientIdentifier(req, user.id);
  const rateLimitResult = friendRequestLimiter(clientId);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { 
        error: "Rate limit exceeded. Please wait before sending more friend requests.",
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        }
      }
    );
  }

  try {
    const body = await req.json();
    const { email, message } = sendFriendRequestSchema.parse(body);

    // Check if trying to add themselves
    if (email === user.email) {
      return NextResponse.json(
        { error: "Cannot send friend request to yourself" },
        { status: 400 }
      );
    }

    // Check if user allows friend requests
    const targetUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, allowFriendRequests: true, name: true, firstName: true, lastName: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!targetUser.allowFriendRequests) {
      return NextResponse.json(
        { error: "User is not accepting friend requests" },
        { status: 400 }
      );
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId: targetUser.id },
          { userId: targetUser.id, friendId: user.id },
        ],
      },
    });

    if (existingFriendship) {
      return NextResponse.json(
        { error: "Friendship already exists or is pending" },
        { status: 400 }
      );
    }

    // Check if friend request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        fromUserId: user.id,
        toEmail: email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "Friend request already sent" },
        { status: 400 }
      );
    }

    // Create friend request
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    const friendRequest = await prisma.friendRequest.create({
      data: {
        fromUserId: user.id,
        toEmail: email,
        message: message || null,
        expiresAt,
      },
      include: {
        fromUser: {
          select: {
            name: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Create notification for the target user
    try {
      const senderName = friendRequest.fromUser.name || 
        (friendRequest.fromUser.firstName && friendRequest.fromUser.lastName 
          ? `${friendRequest.fromUser.firstName} ${friendRequest.fromUser.lastName}`
          : friendRequest.fromUser.email);

      await createFriendRequestNotification(
        targetUser.id,
        senderName,
        friendRequest.id
      );
    } catch (notificationError) {
      // Don't fail the friend request if notification creation fails
      console.error("Error creating friend request notification:", notificationError);
    }

    return NextResponse.json(
      {
        message: "Friend request sent successfully",
        requestId: friendRequest.id,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error sending friend request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
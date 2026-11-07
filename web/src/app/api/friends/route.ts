import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { friendRequestLimiter, getClientIdentifier } from "@/lib/rate-limit";
import {
  FRIEND_REQUEST_MESSAGE_MAX_LENGTH,
  sendFriendRequestFromUserToEmail,
} from "@/lib/friend-request-service";

const sendFriendRequestSchema = z.object({
  email: z.string().trim().email("Invalid email format"),
  message: z.string().trim().max(FRIEND_REQUEST_MESSAGE_MAX_LENGTH).optional(),
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sendFriendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await sendFriendRequestFromUserToEmail(
      user.id,
      parsed.data.email,
      { message: parsed.data.message }
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        message: "Friend request sent successfully",
        requestId: result.requestId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error sending friend request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

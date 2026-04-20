import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

type FriendshipStatus =
  | "SELF"
  | "FRIENDS"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "NONE";

/**
 * GET /api/mobile/users/[id]
 *
 * Returns a minimal public profile for any volunteer. Used for the
 * lightweight profile screen surfaced from comments/avatars in the feed.
 * Includes just enough context (name, avatar, a couple of stats, friendship
 * status, block/report state) for the viewer to decide whether to add, report,
 * or block.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { id: targetId } = await params;

  if (!targetId) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      profilePhotoUrl: true,
      volunteerGrade: true,
      allowFriendRequests: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isSelf = target.id === userId;

  // Friendship status
  let friendshipStatus: FriendshipStatus = "NONE";
  if (isSelf) {
    friendshipStatus = "SELF";
  } else {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId, friendId: targetId },
          { userId: targetId, friendId: userId },
        ],
      },
      select: { status: true, initiatedBy: true },
    });

    if (friendship?.status === "ACCEPTED") {
      friendshipStatus = "FRIENDS";
    } else if (friendship?.status === "PENDING") {
      friendshipStatus =
        friendship.initiatedBy === userId ? "REQUEST_SENT" : "REQUEST_RECEIVED";
    } else {
      // Check for pending FriendRequest by email (used by the web flow)
      const pendingRequest = await prisma.friendRequest.findFirst({
        where: {
          fromUserId: userId,
          toEmail: target.email,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (pendingRequest) friendshipStatus = "REQUEST_SENT";
    }
  }

  // Viewer's block state toward this user
  const block = isSelf
    ? null
    : await prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: { blockerId: userId, blockedId: targetId },
        },
        select: { id: true },
      });

  // Has the viewer already reported this user?
  const report = isSelf
    ? null
    : await prisma.contentReport.findFirst({
        where: {
          reporterId: userId,
          targetType: "user",
          targetId,
        },
        select: { id: true },
      });

  // Minimal stats — total shifts + hours
  const [totalShifts, hoursResult] = await Promise.all([
    prisma.signup.count({
      where: { userId: targetId, status: "CONFIRMED" },
    }),
    prisma.$queryRaw<[{ hours: number }]>`
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (sh."end" - sh.start)) / 3600), 0)::float as hours
      FROM "Signup" s
      JOIN "Shift" sh ON s."shiftId" = sh.id
      WHERE s."userId" = ${targetId}
        AND s.status = 'CONFIRMED'
        AND sh."end" <= NOW()
    `,
  ]);

  const displayName =
    target.name ??
    ([target.firstName, target.lastName].filter(Boolean).join(" ") ||
      "Volunteer");

  return NextResponse.json({
    profile: {
      id: target.id,
      name: displayName,
      firstName: target.firstName ?? target.name?.split(" ")[0] ?? "Volunteer",
      profilePhotoUrl: target.profilePhotoUrl ?? undefined,
      grade: target.volunteerGrade,
      totalShifts,
      hoursVolunteered: Math.round(hoursResult[0].hours),
      friendshipStatus,
      allowFriendRequests: target.allowFriendRequests,
      isBlocked: Boolean(block),
      hasReported: Boolean(report),
      isSelf,
    },
  });
}

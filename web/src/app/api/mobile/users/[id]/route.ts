import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { DAY_EVENING_CUTOFF_HOUR, shiftStartNZ } from "@/lib/concurrent-shifts";
import { formatInNZT } from "@/lib/timezone";

type FriendshipStatus =
  | "SELF"
  | "FRIENDS"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "NONE";

/**
 * GET /api/mobile/users/[id]
 *
 * Returns a public profile for any volunteer. The shape varies with the
 * viewer's relationship to the target:
 *
 * - Always: id, name, photo, totals, friendship status, block/report state.
 * - Viewer is FRIENDS with the target: also returns the rich connection
 *   payload (shared shifts, mutual friends, monthly rhythm, favorite role,
 *   timeline, target's upcoming shifts) so the same screen can render the
 *   "full" profile without a second fetch.
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

  // Viewer's own email (needed to look up incoming FriendRequest rows, which
  // are keyed by recipient email rather than user ID).
  const viewer = isSelf
    ? null
    : await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

  // Friendship status + the FriendRequest id when the viewer has a pending
  // incoming request — the mobile UI needs this id to accept or decline.
  let friendshipStatus: FriendshipStatus = "NONE";
  let incomingRequestId: string | null = null;
  let acceptedFriendship: { createdAt: Date } | null = null;
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
      select: { status: true, initiatedBy: true, createdAt: true },
    });

    if (friendship?.status === "ACCEPTED") {
      friendshipStatus = "FRIENDS";
      acceptedFriendship = { createdAt: friendship.createdAt };
    } else if (friendship?.status === "PENDING") {
      friendshipStatus =
        friendship.initiatedBy === userId ? "REQUEST_SENT" : "REQUEST_RECEIVED";
    } else {
      // Check the FriendRequest table used by both web and mobile send flows.
      const outgoingRequest = await prisma.friendRequest.findFirst({
        where: {
          fromUserId: userId,
          toEmail: target.email,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (outgoingRequest) {
        friendshipStatus = "REQUEST_SENT";
      } else if (viewer?.email) {
        const incomingRequest = await prisma.friendRequest.findFirst({
          where: {
            fromUserId: targetId,
            toEmail: viewer.email,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (incomingRequest) {
          friendshipStatus = "REQUEST_RECEIVED";
          incomingRequestId = incomingRequest.id;
        }
      }
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

  // Minimal stats — total shifts + hours (always shown). Both restrict to
  // completed shifts (end <= now) so totals only reflect work that has
  // actually happened, matching /api/mobile/profile and the web friend
  // profile route.
  const [totalShifts, hoursResult] = await Promise.all([
    prisma.signup.count({
      where: {
        userId: targetId,
        status: "CONFIRMED",
        shift: { end: { lt: new Date() } },
      },
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

  // Custom grade label takes precedence over the user.volunteerGrade column.
  const gradeLabel = await prisma.userCustomLabel.findFirst({
    where: {
      userId: targetId,
      label: {
        name: { in: ["GREEN", "YELLOW", "PINK"] },
        isActive: true,
      },
    },
    select: { label: { select: { name: true } } },
  });
  const grade = (gradeLabel?.label.name ?? target.volunteerGrade ?? "GREEN") as
    | "GREEN"
    | "YELLOW"
    | "PINK";

  // ── Friend-only enrichment ────────────────────────────────────────────────
  // If the viewer and target are accepted friends, include the rich payload
  // the previous /api/mobile/friends/[id] route returned. Letting the same
  // endpoint cover both relationships means the mobile profile screen can
  // render full vs trimmed states from a single fetch.
  let connection: {
    friendsSince: string;
    shiftsTogether: number;
    mutualFriends: number;
    shiftsThisMonth: number;
    avgPerMonth: number;
    favoriteRole: string;
    favoriteRoleCount: number;
    sharedShifts: Array<{
      id: string;
      type: string;
      date: string;
      location: string;
      isUpcoming: boolean;
    }>;
    upcomingShifts: Array<{
      id: string;
      type: string;
      date: string;
      time: string;
      location: string;
    }>;
  } | null = null;

  if (friendshipStatus === "FRIENDS" && acceptedFriendship) {
    const [
      shiftsThisMonthResult,
      shiftsLast6MonthsResult,
      sharedShiftsRaw,
      mutualResult,
      favoriteRoleResult,
      upcomingShiftsRaw,
    ] = await Promise.all([
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count
        FROM "Signup" s
        JOIN "Shift" sh ON s."shiftId" = sh.id
        WHERE s."userId" = ${targetId}
          AND s.status = 'CONFIRMED'
          AND sh.start >= date_trunc('month', NOW())
          AND sh.start < date_trunc('month', NOW()) + interval '1 month'
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count
        FROM "Signup" s
        JOIN "Shift" sh ON s."shiftId" = sh.id
        WHERE s."userId" = ${targetId}
          AND s.status = 'CONFIRMED'
          AND sh."end" >= NOW() - interval '6 months'
          AND sh."end" < NOW()
      `,
      prisma.$queryRaw<
        Array<{
          shift_date: Date;
          period: string;
          location: string;
          latest_start: Date;
        }>
      >`
        WITH user_shifts AS (
          SELECT
            (${shiftStartNZ()})::date as shift_date,
            CASE WHEN EXTRACT(HOUR FROM ${shiftStartNZ()}) < ${DAY_EVENING_CUTOFF_HOUR} THEN 'Day' ELSE 'Evening' END as period,
            sh.location,
            sh.start
          FROM "Signup" s
          JOIN "Shift" sh ON s."shiftId" = sh.id
          WHERE s."userId" = ${userId}
            AND s.status = 'CONFIRMED'
            AND sh.location IS NOT NULL
            AND sh."end" <= NOW()
        ),
        friend_shifts AS (
          SELECT
            (${shiftStartNZ()})::date as shift_date,
            CASE WHEN EXTRACT(HOUR FROM ${shiftStartNZ()}) < ${DAY_EVENING_CUTOFF_HOUR} THEN 'Day' ELSE 'Evening' END as period,
            sh.location,
            sh.start
          FROM "Signup" s
          JOIN "Shift" sh ON s."shiftId" = sh.id
          WHERE s."userId" = ${targetId}
            AND s.status = 'CONFIRMED'
            AND sh.location IS NOT NULL
            AND sh."end" <= NOW()
        )
        SELECT DISTINCT
          us.shift_date,
          us.period,
          us.location,
          GREATEST(us.start, fs.start) as latest_start
        FROM user_shifts us
        JOIN friend_shifts fs
          ON us.shift_date = fs.shift_date
          AND us.period = fs.period
          AND us.location = fs.location
        ORDER BY us.shift_date DESC
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        WITH user_friends AS (
          SELECT CASE WHEN f."userId" = ${userId} THEN f."friendId" ELSE f."userId" END as fid
          FROM "Friendship" f
          WHERE (f."userId" = ${userId} OR f."friendId" = ${userId})
            AND f.status = 'ACCEPTED'
        ),
        target_friends AS (
          SELECT CASE WHEN f."userId" = ${targetId} THEN f."friendId" ELSE f."userId" END as fid
          FROM "Friendship" f
          WHERE (f."userId" = ${targetId} OR f."friendId" = ${targetId})
            AND f.status = 'ACCEPTED'
        )
        SELECT COUNT(DISTINCT uf.fid)::bigint as count
        FROM user_friends uf
        JOIN target_friends tf ON uf.fid = tf.fid
        WHERE uf.fid != ${userId} AND uf.fid != ${targetId}
      `,
      prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT st.name, COUNT(*)::bigint as count
        FROM "Signup" s
        JOIN "Shift" sh ON s."shiftId" = sh.id
        JOIN "ShiftType" st ON sh."shiftTypeId" = st.id
        WHERE s."userId" = ${targetId}
          AND s.status = 'CONFIRMED'
        GROUP BY st.name
        ORDER BY count DESC
        LIMIT 1
      `,
      prisma.$queryRaw<
        Array<{
          shiftId: string;
          typeName: string;
          start: Date;
          location: string | null;
        }>
      >`
        SELECT
          sh.id as "shiftId",
          st.name as "typeName",
          sh.start,
          sh.location
        FROM "Signup" s
        JOIN "Shift" sh ON s."shiftId" = sh.id
        JOIN "ShiftType" st ON sh."shiftTypeId" = st.id
        WHERE s."userId" = ${targetId}
          AND s.status = 'CONFIRMED'
          AND sh.start > NOW()
        ORDER BY sh.start ASC
        LIMIT 5
      `,
    ]);

    const shiftsThisMonth = Number(shiftsThisMonthResult[0].count);
    const shiftsLast6Months = Number(shiftsLast6MonthsResult[0].count);
    // Match the admin milestone analytics' fixed 6-month window so the
    // monthly rate reflects current rhythm, not friendship age.
    const avgPerMonth = Math.round(shiftsLast6Months / 6);

    const now = new Date();
    const sharedShifts = sharedShiftsRaw.slice(0, 6).map((s, i) => ({
      id: `shared-${i}`,
      type: s.period,
      date: s.shift_date.toISOString().split("T")[0],
      location: s.location,
      isUpcoming: s.latest_start > now,
    }));

    const upcomingShifts = upcomingShiftsRaw.map((s) => ({
      id: s.shiftId,
      type: s.typeName,
      date: formatInNZT(s.start, "yyyy-MM-dd"),
      time: formatInNZT(s.start, "h:mm a"),
      location: s.location ?? "TBC",
    }));

    connection = {
      friendsSince: acceptedFriendship.createdAt.toISOString(),
      shiftsTogether: sharedShiftsRaw.length,
      mutualFriends: Number(mutualResult[0].count),
      shiftsThisMonth,
      avgPerMonth,
      favoriteRole: favoriteRoleResult[0]?.name ?? "Volunteer",
      favoriteRoleCount: Number(favoriteRoleResult[0]?.count ?? 0),
      sharedShifts,
      upcomingShifts,
    };
  }

  return NextResponse.json({
    profile: {
      id: target.id,
      name: displayName,
      firstName: target.firstName ?? target.name?.split(" ")[0] ?? "Volunteer",
      profilePhotoUrl: target.profilePhotoUrl ?? undefined,
      grade,
      totalShifts,
      hoursVolunteered: Math.round(hoursResult[0].hours),
      friendshipStatus,
      friendRequestId: incomingRequestId,
      allowFriendRequests: target.allowFriendRequests,
      isBlocked: Boolean(block),
      hasReported: Boolean(report),
      isSelf,
      connection,
    },
  });
}

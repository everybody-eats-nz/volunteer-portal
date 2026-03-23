import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { DAY_EVENING_CUTOFF_HOUR } from "@/lib/concurrent-shifts";

/**
 * GET /api/mobile/friends/[id]
 *
 * Returns a detailed friend profile for the mobile app.
 * Includes stats, shared shifts, upcoming shifts, and favorite role.
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
  const { id: friendId } = await params;

  try {
    // 1. Verify they are actually friends
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json({ error: "Friend not found" }, { status: 404 });
    }

    // 2. Get friend's basic info
    const friend = await prisma.user.findUnique({
      where: { id: friendId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        profilePhotoUrl: true,
        volunteerGrade: true,
      },
    });

    if (!friend) {
      return NextResponse.json({ error: "Friend not found" }, { status: 404 });
    }

    // 3. Get custom grade label if any
    const gradeLabel = await prisma.userCustomLabel.findFirst({
      where: {
        userId: friendId,
        label: {
          name: { in: ["GREEN", "YELLOW", "PINK"] },
          isActive: true,
        },
      },
      select: { label: { select: { name: true } } },
    });

    const grade = (gradeLabel?.label.name ?? friend.volunteerGrade ?? "GREEN") as
      | "GREEN"
      | "YELLOW"
      | "PINK";

    // 4. Friendship date
    const friendsSince = friendship.createdAt.toISOString();

    // 5. Get shift stats for the friend
    const [totalShiftsResult, totalHoursResult, shiftsThisMonthResult, shiftsLast3MonthsResult] =
      await Promise.all([
        // Total confirmed shifts
        prisma.signup.count({
          where: { userId: friendId, status: "CONFIRMED" },
        }),
        // Total hours (sum of shift durations)
        prisma.$queryRaw<[{ hours: number }]>`
          SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (sh."end" - sh.start)) / 3600), 0)::float as hours
          FROM "Signup" s
          JOIN "Shift" sh ON s."shiftId" = sh.id
          WHERE s."userId" = ${friendId}
            AND s.status = 'CONFIRMED'
            AND sh."end" <= NOW()
        `,
        // Shifts this month
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count
          FROM "Signup" s
          JOIN "Shift" sh ON s."shiftId" = sh.id
          WHERE s."userId" = ${friendId}
            AND s.status = 'CONFIRMED'
            AND sh.start >= date_trunc('month', NOW())
            AND sh.start < date_trunc('month', NOW()) + interval '1 month'
        `,
        // Shifts in last 3 months (rolling average)
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*)::bigint as count
          FROM "Signup" s
          JOIN "Shift" sh ON s."shiftId" = sh.id
          WHERE s."userId" = ${friendId}
            AND s.status = 'CONFIRMED'
            AND sh.start >= NOW() - interval '3 months'
            AND sh.start < NOW()
        `,
      ]);

    const totalShifts = totalShiftsResult;
    const hoursVolunteered = Math.round(totalHoursResult[0].hours);
    const shiftsThisMonth = Number(shiftsThisMonthResult[0].count);
    const shiftsLast3Months = Number(shiftsLast3MonthsResult[0].count);

    // 6. Avg shifts per month (rolling 3-month window, capped by friendship duration)
    const daysSinceFriends = Math.max(
      1,
      Math.floor((Date.now() - friendship.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    );
    const friendshipMonths = Math.max(1, Math.floor(daysSinceFriends / 30));
    const monthsForAverage = Math.min(3, friendshipMonths);
    const avgPerMonth = Math.round(shiftsLast3Months / monthsForAverage);

    // 7. Shared shifts (matched by day + AM/PM + location)
    // Single query returns all matches — we use the list for display and length for count
    const sharedShiftsRaw = await prisma.$queryRaw<
      Array<{
        shift_date: Date;
        period: string;
        location: string;
        latest_start: Date;
      }>
    >`
      WITH user_shifts AS (
        SELECT
          (sh.start AT TIME ZONE 'Pacific/Auckland')::date as shift_date,
          CASE WHEN EXTRACT(HOUR FROM sh.start AT TIME ZONE 'Pacific/Auckland') < ${DAY_EVENING_CUTOFF_HOUR} THEN 'Day' ELSE 'Evening' END as period,
          sh.location,
          sh.start
        FROM "Signup" s
        JOIN "Shift" sh ON s."shiftId" = sh.id
        WHERE s."userId" = ${userId} AND s.status = 'CONFIRMED' AND sh.location IS NOT NULL
      ),
      friend_shifts AS (
        SELECT
          (sh.start AT TIME ZONE 'Pacific/Auckland')::date as shift_date,
          CASE WHEN EXTRACT(HOUR FROM sh.start AT TIME ZONE 'Pacific/Auckland') < ${DAY_EVENING_CUTOFF_HOUR} THEN 'Day' ELSE 'Evening' END as period,
          sh.location,
          sh.start
        FROM "Signup" s
        JOIN "Shift" sh ON s."shiftId" = sh.id
        WHERE s."userId" = ${friendId} AND s.status = 'CONFIRMED' AND sh.location IS NOT NULL
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
    `;

    const shiftsTogether = sharedShiftsRaw.length;

    // 8. Mutual friends count
    const mutualResult = await prisma.$queryRaw<[{ count: bigint }]>`
      WITH user_friends AS (
        SELECT CASE WHEN f."userId" = ${userId} THEN f."friendId" ELSE f."userId" END as fid
        FROM "Friendship" f
        WHERE (f."userId" = ${userId} OR f."friendId" = ${userId})
          AND f.status = 'ACCEPTED'
      ),
      target_friends AS (
        SELECT CASE WHEN f."userId" = ${friendId} THEN f."friendId" ELSE f."userId" END as fid
        FROM "Friendship" f
        WHERE (f."userId" = ${friendId} OR f."friendId" = ${friendId})
          AND f.status = 'ACCEPTED'
      )
      SELECT COUNT(DISTINCT uf.fid)::bigint as count
      FROM user_friends uf
      JOIN target_friends tf ON uf.fid = tf.fid
      WHERE uf.fid != ${userId} AND uf.fid != ${friendId}
    `;
    const mutualFriends = Number(mutualResult[0].count);

    // 9. Favorite role (most common shift type)
    const favoriteRoleResult = await prisma.$queryRaw<
      Array<{ name: string; count: bigint }>
    >`
      SELECT st.name, COUNT(*)::bigint as count
      FROM "Signup" s
      JOIN "Shift" sh ON s."shiftId" = sh.id
      JOIN "ShiftType" st ON sh."shiftTypeId" = st.id
      WHERE s."userId" = ${friendId}
        AND s.status = 'CONFIRMED'
      GROUP BY st.name
      ORDER BY count DESC
      LIMIT 1
    `;
    const favoriteRole = favoriteRoleResult[0]?.name ?? "Volunteer";
    const favoriteRoleCount = Number(favoriteRoleResult[0]?.count ?? 0);

    // 10. Map shared shifts for display (most recent 6)
    const now = new Date();
    const sharedShifts = sharedShiftsRaw.slice(0, 6).map((s, i) => ({
      id: `shared-${i}`,
      type: s.period,
      date: s.shift_date.toISOString().split("T")[0],
      location: s.location,
      isUpcoming: s.latest_start > now,
    }));

    // 11. Friend's upcoming shifts (next 5)
    const upcomingShiftsRaw = await prisma.$queryRaw<
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
      WHERE s."userId" = ${friendId}
        AND s.status = 'CONFIRMED'
        AND sh.start > NOW()
      ORDER BY sh.start ASC
      LIMIT 5
    `;

    const upcomingShifts = upcomingShiftsRaw.map((s) => ({
      id: s.shiftId,
      type: s.typeName,
      date: s.start.toISOString().split("T")[0],
      time: s.start.toLocaleTimeString("en-NZ", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      location: s.location ?? "TBC",
    }));

    // 12. Build display name
    const displayName =
      friend.name ??
      [friend.firstName, friend.lastName].filter(Boolean).join(" ") ??
      "Volunteer";

    return NextResponse.json({
      profile: {
        id: friend.id,
        name: displayName,
        profilePhotoUrl: friend.profilePhotoUrl ?? undefined,
        grade,
        shiftsTogether,
        mutualFriends,
        friendsSince,
        totalShifts,
        hoursVolunteered,
        shiftsThisMonth,
        avgPerMonth,
        favoriteRole,
        favoriteRoleCount,
        sharedShifts,
        upcomingShifts,
      },
    });
  } catch (error) {
    console.error("[api/mobile/friends/[id]] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

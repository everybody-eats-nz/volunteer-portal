import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/friends
 *
 * Returns the authenticated user's friends list for the mobile app.
 * Each friend includes: grade (from custom labels or volunteer grade),
 * shiftsTogether count, mutualFriends count, and a relative lastActive string.
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;

  try {
    // 1. Get all accepted friendships for the current user
    const friendsRaw = await prisma.$queryRaw<
      Array<{
        friendId: string;
        name: string | null;
        firstName: string | null;
        lastName: string | null;
        profilePhotoUrl: string | null;
        volunteerGrade: string;
      }>
    >`
      SELECT DISTINCT
        u.id as "friendId",
        u.name,
        u."firstName",
        u."lastName",
        u."profilePhotoUrl",
        u."volunteerGrade"
      FROM "Friendship" f
      JOIN "User" u ON (
        (f."userId" = ${userId} AND u.id = f."friendId") OR
        (f."friendId" = ${userId} AND u.id = f."userId")
      )
      WHERE f.status = 'ACCEPTED' AND u.id != ${userId}
    `;

    if (friendsRaw.length === 0) {
      return NextResponse.json({ friends: [] });
    }

    const friendIds = friendsRaw.map((f) => f.friendId);

    // 2. Get custom labels for grade overrides (GREEN/YELLOW/PINK label names)
    const gradeLabels = await prisma.userCustomLabel.findMany({
      where: {
        userId: { in: friendIds },
        label: {
          name: { in: ["GREEN", "YELLOW", "PINK"] },
          isActive: true,
        },
      },
      select: {
        userId: true,
        label: { select: { name: true } },
      },
    });

    const customGradeMap = new Map<string, string>();
    for (const gl of gradeLabels) {
      // If a user has multiple grade labels, last wins (shouldn't normally happen)
      customGradeMap.set(gl.userId, gl.label.name);
    }

    // 3. Count shifts together (both users CONFIRMED on the same shift)
    const shiftTogetherCounts = await prisma.$queryRaw<
      Array<{ friendId: string; count: bigint }>
    >`
      SELECT
        s2."userId" as "friendId",
        COUNT(DISTINCT s1."shiftId")::bigint as count
      FROM "Signup" s1
      JOIN "Signup" s2 ON s1."shiftId" = s2."shiftId"
      WHERE s1."userId" = ${userId}
        AND s2."userId" = ANY(${friendIds}::text[])
        AND s1.status = 'CONFIRMED'
        AND s2.status = 'CONFIRMED'
        AND s1."userId" != s2."userId"
      GROUP BY s2."userId"
    `;

    const shiftsTogetherMap = new Map<string, number>();
    for (const row of shiftTogetherCounts) {
      shiftsTogetherMap.set(row.friendId, Number(row.count));
    }

    // 4. Count mutual friends for each friend
    // A mutual friend is someone who is ACCEPTED friends with both the user and the friend
    const mutualFriendCounts = await prisma.$queryRaw<
      Array<{ friendId: string; count: bigint }>
    >`
      WITH user_friends AS (
        SELECT CASE WHEN f."userId" = ${userId} THEN f."friendId" ELSE f."userId" END as friend_id
        FROM "Friendship" f
        WHERE (f."userId" = ${userId} OR f."friendId" = ${userId})
          AND f.status = 'ACCEPTED'
      ),
      friend_friends AS (
        SELECT
          ff.target_friend,
          CASE WHEN f."userId" = ff.target_friend THEN f."friendId" ELSE f."userId" END as friend_id
        FROM "Friendship" f
        CROSS JOIN (SELECT unnest(${friendIds}::text[]) as target_friend) ff
        WHERE (f."userId" = ff.target_friend OR f."friendId" = ff.target_friend)
          AND f.status = 'ACCEPTED'
      )
      SELECT
        ff.target_friend as "friendId",
        COUNT(DISTINCT ff.friend_id)::bigint as count
      FROM friend_friends ff
      JOIN user_friends uf ON ff.friend_id = uf.friend_id
      WHERE ff.friend_id != ${userId}
        AND ff.target_friend != ff.friend_id
      GROUP BY ff.target_friend
    `;

    const mutualFriendsMap = new Map<string, number>();
    for (const row of mutualFriendCounts) {
      mutualFriendsMap.set(row.friendId, Number(row.count));
    }

    // 5. Get last activity (most recent confirmed shift end date) for each friend
    const lastShiftDates = await prisma.$queryRaw<
      Array<{ userId: string; lastShiftEnd: Date }>
    >`
      SELECT
        s."userId",
        MAX(sh."end") as "lastShiftEnd"
      FROM "Signup" s
      JOIN "Shift" sh ON s."shiftId" = sh.id
      WHERE s."userId" = ANY(${friendIds}::text[])
        AND s.status = 'CONFIRMED'
        AND sh."end" <= NOW()
      GROUP BY s."userId"
    `;

    const lastActiveMap = new Map<string, Date>();
    for (const row of lastShiftDates) {
      lastActiveMap.set(row.userId, row.lastShiftEnd);
    }

    // 6. Build the response
    const friends = friendsRaw.map((friend) => {
      const displayName =
        friend.name ??
        [friend.firstName, friend.lastName].filter(Boolean).join(" ") ??
        "Volunteer";

      // Use custom label grade if available, otherwise fall back to volunteerGrade
      const grade = (customGradeMap.get(friend.friendId) ??
        friend.volunteerGrade ??
        "GREEN") as "GREEN" | "YELLOW" | "PINK";

      return {
        id: friend.friendId,
        name: displayName,
        profilePhotoUrl: friend.profilePhotoUrl ?? undefined,
        grade,
        shiftsTogether: shiftsTogetherMap.get(friend.friendId) ?? 0,
        mutualFriends: mutualFriendsMap.get(friend.friendId) ?? 0,
        lastActive: formatLastActive(lastActiveMap.get(friend.friendId)),
      };
    });

    return NextResponse.json({ friends });
  } catch (error) {
    console.error("[api/mobile/friends] Error fetching friends:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Converts a Date into a human-readable relative time string
 * for the "lastActive" field in the friend list.
 */
function formatLastActive(date: Date | undefined): string {
  if (!date) return "No shifts yet";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 60) return "Today";
  if (diffHours < 24) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

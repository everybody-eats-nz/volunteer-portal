import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/feed
 *
 * Returns a unified activity feed for the mobile home screen.
 * Pulls real data from:
 * - Recent achievement unlocks (friends + own)
 * - Milestone events (volunteers crossing shift count thresholds)
 *
 * Items are sorted by timestamp descending and limited to the last 14 days.
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const since = new Date();
  since.setDate(since.getDate() - 14);

  // Get the user's accepted friend IDs first
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ userId }, { friendId: userId }],
    },
    select: { userId: true, friendId: true },
  });

  const friendIds = friendships.map((f) =>
    f.userId === userId ? f.friendId : f.userId
  );
  // Include self + friends for feed visibility
  const visibleUserIds = [userId, ...friendIds];

  // Run remaining queries in parallel
  const [recentAchievements, milestoneUsers] = await Promise.all([
    // Recent achievement unlocks (friends + own, last 14 days)
    prisma.userAchievement.findMany({
      where: {
        unlockedAt: { gte: since },
        userId: { in: visibleUserIds },
      },
      include: {
        user: {
          select: { id: true, name: true, firstName: true, profilePhotoUrl: true },
        },
        achievement: {
          select: { name: true, description: true, icon: true, category: true },
        },
      },
      orderBy: { unlockedAt: "desc" },
      take: 10,
    }),

    // Milestone candidates: volunteers who recently completed a shift and
    // whose total confirmed-shift count just crossed a milestone threshold.
    // We find recent signups for past shifts, then check the user's total count.
    prisma.signup.findMany({
      where: {
        status: "CONFIRMED",
        shift: { end: { lt: new Date(), gte: since } },
      },
      select: {
        userId: true,
        shift: { select: { end: true } },
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            profilePhotoUrl: true,
            _count: {
              select: {
                signups: {
                  where: {
                    status: "CONFIRMED",
                    shift: { end: { lt: new Date() } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { shift: { end: "desc" } },
      take: 50,
    }),
  ]);

  type FeedItem = {
    type: string;
    id: string;
    timestamp: string;
    [key: string]: unknown;
  };

  const items: FeedItem[] = [];

  // Transform achievements into feed items
  const friendIdSet = new Set(friendIds);
  for (const ua of recentAchievements) {
    const isMe = ua.user.id === userId;
    const displayName = isMe ? "You" : (ua.user.firstName ?? ua.user.name ?? "A volunteer");

    items.push({
      type: "achievement",
      id: `achievement-${ua.id}`,
      userName: displayName,
      profilePhotoUrl: isMe ? undefined : (ua.user.profilePhotoUrl ?? undefined),
      achievementName: ua.achievement.name,
      achievementIcon: ua.achievement.icon,
      description: ua.achievement.description,
      timestamp: ua.unlockedAt.toISOString(),
      isFriend: friendIdSet.has(ua.user.id),
      likes: [],
    });
  }

  // Extract milestones from recent signups
  const MILESTONE_THRESHOLDS = [10, 25, 50, 75, 100, 150, 200];
  const seenMilestones = new Set<string>();

  for (const signup of milestoneUsers) {
    const totalShifts = signup.user._count.signups;
    // Find the highest milestone they just crossed
    const milestone = [...MILESTONE_THRESHOLDS].reverse().find((t) => totalShifts >= t);
    if (!milestone) continue;

    // Deduplicate: one milestone per user per threshold
    const key = `${signup.userId}-${milestone}`;
    if (seenMilestones.has(key)) continue;
    seenMilestones.add(key);

    // Only include if they're right at or just past the threshold (within 2 shifts)
    if (totalShifts - milestone > 2) continue;

    const isMe = signup.userId === userId;
    const displayName = isMe ? "You" : (signup.user.firstName ?? signup.user.name ?? "A volunteer");

    items.push({
      type: "milestone",
      id: `milestone-${signup.userId}-${milestone}`,
      userName: displayName,
      profilePhotoUrl: isMe ? undefined : (signup.user.profilePhotoUrl ?? undefined),
      count: milestone,
      timestamp: signup.shift.end.toISOString(),
      isFriend: friendIdSet.has(signup.userId),
      likes: [],
    });
  }

  // Sort by timestamp descending
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ items });
}

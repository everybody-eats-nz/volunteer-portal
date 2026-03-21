import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/feed
 *
 * Returns a unified activity feed for the mobile home screen.
 * Pulls real data from:
 * - Recent achievement unlocks (community-wide)
 * - Recently posted shifts
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

  // Run all queries in parallel
  const [recentAchievements, recentShifts, milestoneUsers] = await Promise.all([
    // Recent achievement unlocks (community-wide, last 14 days)
    prisma.userAchievement.findMany({
      where: {
        unlockedAt: { gte: since },
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

    // Recently created shifts (last 14 days, upcoming only)
    prisma.shift.findMany({
      where: {
        createdAt: { gte: since },
        start: { gte: new Date() },
      },
      include: {
        shiftType: true,
        signups: { where: { status: "CONFIRMED" } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
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
      isFriend: !isMe,
      likes: [],
    });
  }

  // Transform recent shifts into feed items
  for (const shift of recentShifts) {
    items.push({
      type: "new_shift",
      id: `shift-${shift.id}`,
      shift: {
        id: shift.id,
        shiftType: {
          id: shift.shiftType.id,
          name: shift.shiftType.name,
          description: shift.shiftType.description ?? "",
        },
        start: shift.start.toISOString(),
        end: shift.end.toISOString(),
        location: shift.location ?? "TBC",
        capacity: shift.capacity,
        signedUp: shift.signups.length,
        status: null,
        notes: shift.notes,
      },
      timestamp: shift.createdAt.toISOString(),
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
      isFriend: !isMe,
      likes: [],
    });
  }

  // Sort by timestamp descending
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ items });
}

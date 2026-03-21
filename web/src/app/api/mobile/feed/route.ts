import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { getStartOfDayUTC } from "@/lib/timezone";

/**
 * GET /api/mobile/feed
 *
 * Returns a unified activity feed for the mobile home screen.
 * Pulls real data from:
 * - Recent achievement unlocks (friends + own)
 * - Milestone events (volunteers crossing shift count thresholds)
 * - Friend signups (friends signing up for shifts)
 * - Shift recaps (aggregate stats for completed shifts at user's locations)
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
  const [recentAchievements, milestoneUsers, friendSignups, userLocations] =
    await Promise.all([
      // Recent achievement unlocks (friends + own, last 14 days)
      prisma.userAchievement.findMany({
        where: {
          unlockedAt: { gte: since },
          userId: { in: visibleUserIds },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              profilePhotoUrl: true,
            },
          },
          achievement: {
            select: {
              name: true,
              description: true,
              icon: true,
              category: true,
            },
          },
        },
        orderBy: { unlockedAt: "desc" },
        take: 10,
      }),

      // Milestone candidates: volunteers who recently completed a shift and
      // whose total confirmed-shift count just crossed a milestone threshold.
      prisma.signup.findMany({
        where: {
          status: "CONFIRMED",
          userId: { in: visibleUserIds },
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

      // Friend signups: friends who recently signed up for upcoming shifts
      prisma.signup.findMany({
        where: {
          status: "CONFIRMED",
          userId: { in: friendIds },
          createdAt: { gte: since },
        },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              profilePhotoUrl: true,
            },
          },
          shift: {
            select: {
              start: true,
              location: true,
              shiftType: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),

      // Locations the current user has signed up for (to scope shift recaps)
      prisma.signup.findMany({
        where: {
          userId,
          status: "CONFIRMED",
          shift: { location: { not: null } },
        },
        select: { shift: { select: { location: true } } },
        distinct: ["shiftId"],
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

  // Transform friend signups into feed items
  for (const signup of friendSignups) {
    const displayName =
      signup.user.firstName ?? signup.user.name ?? "A volunteer";

    items.push({
      type: "friend_signup",
      id: `friend-signup-${signup.id}`,
      userName: displayName,
      profilePhotoUrl: signup.user.profilePhotoUrl ?? undefined,
      shiftTypeName: signup.shift.shiftType.name,
      shiftDate: signup.shift.start.toISOString(),
      location: signup.shift.location ?? "",
      timestamp: signup.createdAt.toISOString(),
      isFriend: true,
      likes: [],
    });
  }

  // Build shift recaps — aggregate completed shifts by location+date,
  // but only for locations the user has volunteered at
  const myLocations = new Set(
    userLocations
      .map((s) => s.shift.location)
      .filter((loc): loc is string => loc !== null)
  );

  if (myLocations.size > 0) {
    const locationsList = [...myLocations];
    const [recapShifts, mealsServedRecords, locationDefaults] =
      await Promise.all([
        prisma.shift.findMany({
          where: {
            end: { lt: new Date(), gte: since },
            location: { in: locationsList },
          },
          select: {
            id: true,
            start: true,
            end: true,
            location: true,
            _count: {
              select: { signups: { where: { status: "CONFIRMED" } } },
            },
          },
          orderBy: { start: "desc" },
        }),
        prisma.mealsServed.findMany({
          where: {
            date: { gte: since },
            location: { in: locationsList },
          },
          select: { date: true, location: true, mealsServed: true },
        }),
        // Fallback defaults for days without recorded meals
        prisma.location.findMany({
          where: { name: { in: locationsList } },
          select: { name: true, defaultMealsServed: true },
        }),
      ]);

    // Index meals served by location + NZ-timezone date key
    // MealsServed.date is stored as start-of-day in NZ timezone (as UTC)
    const mealsMap = new Map<string, number>();
    for (const record of mealsServedRecords) {
      const key = `${record.location}-${record.date.toISOString()}`;
      mealsMap.set(key, record.mealsServed);
    }

    const defaultsMap = new Map(
      locationDefaults.map((loc) => [loc.name, loc.defaultMealsServed])
    );

    // Group by location + date (NZ timezone day)
    const recapGroups = new Map<
      string,
      {
        location: string;
        displayDate: string;
        volunteerHours: number;
        mealsServed: number;
        latestStart: Date;
      }
    >();

    for (const shift of recapShifts) {
      if (!shift.location || shift._count.signups === 0) continue;

      // Use NZ timezone start-of-day to match MealsServed date storage
      const nzStartOfDay = getStartOfDayUTC(shift.start);
      const mealsKey = `${shift.location}-${nzStartOfDay.toISOString()}`;
      const displayDate = shift.start.toISOString().slice(0, 10);
      const groupKey = `${shift.location}-${displayDate}`;

      const shiftDurationHours =
        (shift.end.getTime() - shift.start.getTime()) / (1000 * 60 * 60);
      const totalHours = shiftDurationHours * shift._count.signups;

      const existing = recapGroups.get(groupKey);
      if (existing) {
        existing.volunteerHours += totalHours;
        if (shift.start > existing.latestStart) {
          existing.latestStart = shift.start;
        }
      } else {
        // Look up actual meals, fall back to location default
        const meals =
          mealsMap.get(mealsKey) ?? defaultsMap.get(shift.location) ?? 0;

        recapGroups.set(groupKey, {
          location: shift.location,
          displayDate,
          volunteerHours: totalHours,
          mealsServed: meals,
          latestStart: shift.start,
        });
      }
    }

    for (const [key, recap] of recapGroups) {
      items.push({
        type: "shift_recap",
        id: `shift-recap-${key}`,
        location: recap.location,
        date: recap.displayDate,
        mealsServed: recap.mealsServed,
        volunteerHours: Math.round(recap.volunteerHours),
        timestamp: recap.latestStart.toISOString(),
        likes: [],
      });
    }
  }

  // Sort by timestamp descending
  items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json({ items });
}

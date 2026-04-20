import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { getStartOfDayUTC, formatInNZT } from "@/lib/timezone";

/**
 * GET /api/mobile/feed
 *
 * Returns a unified activity feed for the mobile home screen.
 * Pulls real data from:
 * - Admin announcements (targeted to the requesting user)
 * - Recent achievement unlocks (friends + own)
 * - Milestone events (volunteers crossing shift count thresholds)
 * - Friend signups (friends signing up for shifts)
 * - Shift recaps (aggregate stats for completed shifts at user's locations)
 *
 * Every item includes likeCount, likedByMe, recentLikers, commentCount.
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
  const now = new Date();

  // Get the user's profile, friendships, and blocks in parallel
  const [userProfile, friendships, blocks] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        volunteerGrade: true,
        availableLocations: true,
        customLabels: { select: { labelId: true } },
      },
    }),
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ userId }, { friendId: userId }],
      },
      select: { userId: true, friendId: true },
    }),
    // Users this person has blocked
    prisma.userBlock.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    }),
  ]);

  const blockedUserIds = new Set(blocks.map((b) => b.blockedId));

  const friendIds = friendships
    .map((f) => (f.userId === userId ? f.friendId : f.userId))
    // Exclude blocked users from friend feed
    .filter((id) => !blockedUserIds.has(id));
  const visibleUserIds = [userId, ...friendIds].filter(
    (id) => !blockedUserIds.has(id)
  );

  const userLabelIds = (userProfile?.customLabels ?? []).map((l) => l.labelId);
  const userLocations = userProfile?.availableLocations
    ? userProfile.availableLocations.split(",").map((l) => l.trim()).filter(Boolean)
    : [];
  const userGrade = userProfile?.volunteerGrade ?? "GREEN";

  // Run all data queries in parallel
  const [
    recentAchievements,
    milestoneUsers,
    friendSignups,
    userSignupLocations,
    announcements,
  ] = await Promise.all([
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

    // Milestone candidates: volunteers who recently completed a shift
    prisma.signup.findMany({
      where: {
        status: "CONFIRMED",
        userId: { in: visibleUserIds },
        shift: { end: { lt: now, gte: since } },
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
                    shift: { end: { lt: now } },
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

    // Friend signups: friends who recently confirmed onto upcoming shifts
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

    // Announcements: fetch all non-expired ones from the window, then filter by
    // user targeting in app code. Grade and label are pre-filtered at DB level;
    // location targeting uses in-memory exact matching (availableLocations is a
    // comma-separated string so we can't safely do it in Prisma without raw SQL).
    prisma.announcement.findMany({
      where: {
        createdAt: { gte: since },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
        // Pre-filter: skip announcements that explicitly exclude this user's grade
        AND: [
          userProfile?.volunteerGrade
            ? {
                OR: [
                  { targetGrades: { isEmpty: true } },
                  { targetGrades: { has: userProfile.volunteerGrade } },
                ],
              }
            : {},
        ],
      },
      include: {
        author: {
          select: { id: true, name: true, firstName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  type FeedItem = {
    type: string;
    id: string;
    timestamp: string;
    [key: string]: unknown;
  };

  const items: FeedItem[] = [];

  // Filter announcements to those targeting this user
  const friendIdSet = new Set(friendIds);

  for (const ann of announcements) {
    // Location targeting: empty = all locations
    const locationMatch =
      ann.targetLocations.length === 0 ||
      ann.targetLocations.some((loc) => userLocations.includes(loc));

    // Grade targeting: empty = all grades
    const gradeMatch =
      ann.targetGrades.length === 0 ||
      ann.targetGrades.includes(userGrade);

    // Label targeting: empty = all labels
    const labelMatch =
      ann.targetLabelIds.length === 0 ||
      ann.targetLabelIds.some((lid) => userLabelIds.includes(lid));

    if (!locationMatch || !gradeMatch || !labelMatch) continue;

    const authorName =
      ann.author.firstName ?? ann.author.name ?? "Admin";

    items.push({
      type: "announcement",
      id: `announcement-${ann.id}`,
      title: ann.title,
      body: ann.body,
      imageUrl: ann.imageUrl ?? undefined,
      timestamp: ann.createdAt.toISOString(),
      author: authorName,
      likeCount: 0,
      likedByMe: false,
      recentLikers: [],
      commentCount: 0,
    });
  }

  // Transform achievements into feed items
  for (const ua of recentAchievements) {
    const isMe = ua.user.id === userId;
    const displayName = isMe
      ? "You"
      : (ua.user.firstName ?? ua.user.name ?? "A volunteer");

    items.push({
      type: "achievement",
      id: `achievement-${ua.id}`,
      userId: isMe ? undefined : ua.user.id,
      userName: displayName,
      profilePhotoUrl: isMe ? undefined : (ua.user.profilePhotoUrl ?? undefined),
      achievementName: ua.achievement.name,
      achievementIcon: ua.achievement.icon,
      description: ua.achievement.description,
      timestamp: ua.unlockedAt.toISOString(),
      isFriend: friendIdSet.has(ua.user.id),
      likeCount: 0,
      likedByMe: false,
      recentLikers: [],
      commentCount: 0,
    });
  }

  // Extract milestones from recent signups
  const MILESTONE_THRESHOLDS = [10, 25, 50, 75, 100, 150, 200];
  const seenMilestones = new Set<string>();

  for (const signup of milestoneUsers) {
    const totalShifts = signup.user._count.signups;
    const milestone = [...MILESTONE_THRESHOLDS]
      .reverse()
      .find((t) => totalShifts >= t);
    if (!milestone) continue;

    const key = `${signup.userId}-${milestone}`;
    if (seenMilestones.has(key)) continue;
    seenMilestones.add(key);

    if (totalShifts - milestone > 2) continue;

    const isMe = signup.userId === userId;
    const displayName = isMe
      ? "You"
      : (signup.user.firstName ?? signup.user.name ?? "A volunteer");

    items.push({
      type: "milestone",
      id: `milestone-${signup.userId}-${milestone}`,
      userId: isMe ? undefined : signup.userId,
      userName: displayName,
      profilePhotoUrl: isMe ? undefined : (signup.user.profilePhotoUrl ?? undefined),
      count: milestone,
      timestamp: signup.shift.end.toISOString(),
      isFriend: friendIdSet.has(signup.userId),
      likeCount: 0,
      likedByMe: false,
      recentLikers: [],
      commentCount: 0,
    });
  }

  // Transform friend signups into feed items
  for (const signup of friendSignups) {
    const displayName =
      signup.user.firstName ?? signup.user.name ?? "A volunteer";

    items.push({
      type: "friend_signup",
      id: `friend-signup-${signup.id}`,
      userId: signup.userId,
      userName: displayName,
      profilePhotoUrl: signup.user.profilePhotoUrl ?? undefined,
      shiftTypeName: signup.shift.shiftType.name,
      shiftDate: signup.shift.start.toISOString(),
      location: signup.shift.location ?? "",
      timestamp: signup.createdAt.toISOString(),
      isFriend: true,
      likeCount: 0,
      likedByMe: false,
      recentLikers: [],
      commentCount: 0,
    });
  }

  // Build shift recaps
  const mySignupLocations = new Set(
    userSignupLocations
      .map((s) => s.shift.location)
      .filter((loc): loc is string => loc !== null)
  );

  if (mySignupLocations.size > 0) {
    const locationsList = [...mySignupLocations];
    const [recapShifts, mealsServedRecords, locationDefaults] =
      await Promise.all([
        prisma.shift.findMany({
          where: {
            end: { lt: now, gte: since },
            location: { in: locationsList },
          },
          select: {
            id: true,
            start: true,
            end: true,
            location: true,
            signups: {
              where: { status: "CONFIRMED" },
              select: { userId: true },
            },
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
        prisma.location.findMany({
          where: { name: { in: locationsList } },
          select: { name: true, defaultMealsServed: true },
        }),
      ]);

    const mealsMap = new Map<string, number>();
    for (const record of mealsServedRecords) {
      const key = `${record.location}-${record.date.toISOString()}`;
      mealsMap.set(key, record.mealsServed);
    }

    const defaultsMap = new Map(
      locationDefaults.map((loc) => [loc.name, loc.defaultMealsServed])
    );

    const recapGroups = new Map<
      string,
      {
        location: string;
        displayDate: string;
        volunteerHours: number;
        volunteerCount: number;
        mealsServed: number;
        latestStart: Date;
      }
    >();

    const recapVolunteers = new Map<string, Set<string>>();

    for (const shift of recapShifts) {
      if (!shift.location || shift._count.signups === 0) continue;

      const nzStartOfDay = getStartOfDayUTC(shift.start);
      const mealsKey = `${shift.location}-${nzStartOfDay.toISOString()}`;
      const displayDate = formatInNZT(shift.start, "yyyy-MM-dd");
      const groupKey = `${shift.location}-${displayDate}`;

      const shiftDurationHours =
        (shift.end.getTime() - shift.start.getTime()) / (1000 * 60 * 60);
      const totalHours = shiftDurationHours * shift._count.signups;

      if (!recapVolunteers.has(groupKey)) {
        recapVolunteers.set(groupKey, new Set());
      }
      const volunteerSet = recapVolunteers.get(groupKey)!;
      for (const s of shift.signups) {
        volunteerSet.add(s.userId);
      }

      const existing = recapGroups.get(groupKey);
      if (existing) {
        existing.volunteerHours += totalHours;
        existing.volunteerCount = volunteerSet.size;
        if (shift.start > existing.latestStart) {
          existing.latestStart = shift.start;
        }
      } else {
        const meals =
          mealsMap.get(mealsKey) ?? defaultsMap.get(shift.location) ?? 0;

        recapGroups.set(groupKey, {
          location: shift.location,
          displayDate,
          volunteerHours: totalHours,
          volunteerCount: volunteerSet.size,
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
        volunteerCount: recap.volunteerCount,
        timestamp: recap.latestStart.toISOString(),
        likeCount: 0,
        likedByMe: false,
        recentLikers: [],
        commentCount: 0,
      });
    }
  }

  // Sort by timestamp descending
  items.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (items.length === 0) {
    return NextResponse.json({ items });
  }

  // Batch-fetch real like/comment data for all items
  const itemIds = items.map((i) => i.id);

  const [likeCounts, likedByMeRows, commentCounts, recentLikerRows] =
    await Promise.all([
      // Total like count per item
      prisma.feedLike.groupBy({
        by: ["feedItemId"],
        where: { feedItemId: { in: itemIds } },
        _count: { id: true },
      }),

      // Which items the current user has liked
      prisma.feedLike.findMany({
        where: { userId, feedItemId: { in: itemIds } },
        select: { feedItemId: true },
      }),

      // Total comment count per item
      prisma.feedComment.groupBy({
        by: ["feedItemId"],
        where: { feedItemId: { in: itemIds } },
        _count: { id: true },
      }),

      // Top 6 likers per item (for the likes sheet)
      prisma.feedLike.findMany({
        where: { feedItemId: { in: itemIds } },
        include: {
          user: {
            select: { id: true, name: true, firstName: true, profilePhotoUrl: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: itemIds.length * 6,
      }),
    ]);

  // Build lookup maps
  const likeCountMap = new Map(
    likeCounts.map((r) => [r.feedItemId, r._count.id])
  );
  const likedByMeSet = new Set(likedByMeRows.map((r) => r.feedItemId));
  const commentCountMap = new Map(
    commentCounts.map((r) => [r.feedItemId, r._count.id])
  );

  // Group recent likers by feedItemId, cap at 6
  const recentLikersMap = new Map<
    string,
    Array<{ id: string; name: string; profilePhotoUrl?: string }>
  >();
  for (const like of recentLikerRows) {
    const existing = recentLikersMap.get(like.feedItemId) ?? [];
    if (existing.length < 6) {
      existing.push({
        id: like.user.id,
        name: like.user.firstName ?? like.user.name ?? "Volunteer",
        profilePhotoUrl: like.user.profilePhotoUrl ?? undefined,
      });
      recentLikersMap.set(like.feedItemId, existing);
    }
  }

  // Merge interaction data into items
  for (const item of items) {
    item.likeCount = likeCountMap.get(item.id) ?? 0;
    item.likedByMe = likedByMeSet.has(item.id);
    item.commentCount = commentCountMap.get(item.id) ?? 0;
    item.recentLikers = recentLikersMap.get(item.id) ?? [];
  }

  return NextResponse.json({ items });
}

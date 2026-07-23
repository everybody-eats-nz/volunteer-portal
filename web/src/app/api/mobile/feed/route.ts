import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import {
  getStartOfDayUTC,
  formatInNZT,
  isSameDayInNZT,
} from "@/lib/timezone";
import { ANNOUNCEMENT_SHIFT_TARGET_STATUSES } from "@/lib/announcement-targeting";
import { userMatchesTargetLocations } from "@/lib/user-locations";
import { formatAchievementCriteria } from "@/lib/achievement-utils";
import {
  getRecentCmsJournalPosts,
  getUpcomingCmsEvents,
} from "@/lib/services/marketing-cms";

function parseCriteriaShiftTypeId(criteria: string): string | undefined {
  try {
    const parsed = JSON.parse(criteria);
    return typeof parsed?.shiftType === "string" ? parsed.shiftType : undefined;
  } catch {
    return undefined;
  }
}

/**
 * GET /api/mobile/feed
 *
 * Returns a unified activity feed for the mobile home screen.
 * Pulls real data from:
 * - Admin announcements (targeted to the requesting user)
 * - Recent achievement unlocks (friends + own)
 * - Friend signups (friends signing up for shifts)
 * - Shift recaps (aggregate stats for completed shifts at user's locations)
 * - New shifts published for the user's default location
 * - Daily menus published for the user's default location
 * - Community events and journal posts from the marketing CMS
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

  // Client-supplied IDs for items the API doesn't construct itself (e.g. dummy
  // photo posts). We still fetch real interaction counts for them so the UI
  // can show accurate like/comment state.
  const url = new URL(request.url);
  const extraIdsParam = url.searchParams.get("extraIds") ?? "";
  const extraIds = extraIdsParam
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 200)
    .slice(0, 50);

  // Marketing CMS content doesn't depend on the user, so kick those requests
  // off first and await them alongside the per-user queries below. Both
  // resolve to [] when the CMS is unconfigured or unreachable.
  const cmsEventsPromise = getUpcomingCmsEvents();
  const cmsJournalPostsPromise = getRecentCmsJournalPosts();

  // Get the user's profile, friendships, blocks, and active signup shift IDs
  // in parallel. The signup shift IDs are used to match announcements that
  // target specific shifts.
  const [userProfile, friendships, blocks, userSignupShiftRows] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          volunteerGrade: true,
          defaultLocation: true,
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
      prisma.signup.findMany({
        where: {
          userId,
          // Mirror the targeting helper so a user is "associated with" a shift
          // here for the same statuses the announcements form uses.
          status: { in: ANNOUNCEMENT_SHIFT_TARGET_STATUSES.map((s) => s) },
        },
        select: { shiftId: true },
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
  const userDefaultLocation = userProfile?.defaultLocation ?? null;
  const userGrade = userProfile?.volunteerGrade ?? "GREEN";
  const userSignupShiftIds = new Set(
    userSignupShiftRows.map((s) => s.shiftId)
  );

  // Run all data queries in parallel
  const [
    recentAchievements,
    friendSignups,
    userSignupLocations,
    announcements,
    newShifts,
    dailyMenus,
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
            criteria: true,
          },
        },
      },
      orderBy: { unlockedAt: "desc" },
      take: 10,
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
            id: true,
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
    // location targeting is matched against the user's defaultLocation.
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

    // New shifts published at the user's default location. Only upcoming shifts
    // created in the last 14 days. We aggregate by creation day + location in
    // app code so a bulk-publish of a month of shifts becomes one feed item.
    userDefaultLocation
      ? prisma.shift.findMany({
          where: {
            location: userDefaultLocation,
            createdAt: { gte: since },
            start: { gt: now },
          },
          select: {
            id: true,
            start: true,
            createdAt: true,
            location: true,
            shiftType: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),

    // Daily menus published for the user's default location. Includes both
    // upcoming and recent past service dates so volunteers can still see what
    // was on the menu after the fact — the 14-day createdAt window keeps the
    // feed fresh.
    userDefaultLocation
      ? prisma.dailyMenu.findMany({
          where: {
            location: userDefaultLocation,
            createdAt: { gte: since },
          },
          select: {
            id: true,
            date: true,
            location: true,
            chefName: true,
            announcement: true,
            starter: true,
            mains: true,
            drink: true,
            dessert: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  const [cmsEvents, cmsJournalPosts] = await Promise.all([
    cmsEventsPromise,
    cmsJournalPostsPromise,
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
    // Location targeting: empty = all locations. Matches the recipient
    // conditions in announcement-targeting.ts (default OR available
    // locations) so a pushed announcement is visible in the feed it links to.
    const locationMatch = userMatchesTargetLocations(
      {
        defaultLocation: userDefaultLocation,
        availableLocations: userProfile?.availableLocations ?? null,
      },
      ann.targetLocations
    );

    // Grade targeting: empty = all grades
    const gradeMatch =
      ann.targetGrades.length === 0 ||
      ann.targetGrades.includes(userGrade);

    // Label targeting: empty = all labels
    const labelMatch =
      ann.targetLabelIds.length === 0 ||
      ann.targetLabelIds.some((lid) => userLabelIds.includes(lid));

    // Specific user targeting: empty = all users
    const userMatch =
      ann.targetUserIds.length === 0 || ann.targetUserIds.includes(userId);

    // Shift targeting: empty = all shifts. Match if the user has an active
    // signup on any of the targeted shifts.
    const shiftMatch =
      ann.targetShiftIds.length === 0 ||
      ann.targetShiftIds.some((sid) => userSignupShiftIds.has(sid));

    if (!locationMatch || !gradeMatch || !labelMatch || !userMatch || !shiftMatch)
      continue;

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

  // Resolve shift-type names referenced by any achievement criteria so we can
  // build human-readable strings (e.g. "Complete 5 Kitchen Prep shifts").
  const criteriaShiftTypeIds = new Set<string>();
  for (const ua of recentAchievements) {
    const id = parseCriteriaShiftTypeId(ua.achievement.criteria);
    if (id) criteriaShiftTypeIds.add(id);
  }
  const shiftTypeNameById =
    criteriaShiftTypeIds.size > 0
      ? new Map(
          (
            await prisma.shiftType.findMany({
              where: { id: { in: Array.from(criteriaShiftTypeIds) } },
              select: { id: true, name: true },
            })
          ).map((st) => [st.id, st.name])
        )
      : new Map<string, string>();

  // Transform achievements into feed items
  for (const ua of recentAchievements) {
    const isMe = ua.user.id === userId;
    const displayName = isMe
      ? "You"
      : (ua.user.firstName ?? ua.user.name ?? "A volunteer");

    const shiftTypeId = parseCriteriaShiftTypeId(ua.achievement.criteria);
    const shiftTypeName = shiftTypeId
      ? shiftTypeNameById.get(shiftTypeId)
      : undefined;

    items.push({
      type: "achievement",
      id: `achievement-${ua.id}`,
      userId: isMe ? undefined : ua.user.id,
      userName: displayName,
      profilePhotoUrl: isMe ? undefined : (ua.user.profilePhotoUrl ?? undefined),
      achievementName: ua.achievement.name,
      achievementIcon: ua.achievement.icon,
      description: ua.achievement.description,
      criteria: formatAchievementCriteria(
        ua.achievement.criteria,
        shiftTypeName
      ),
      timestamp: ua.unlockedAt.toISOString(),
      isFriend: friendIdSet.has(ua.user.id),
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
      shiftId: signup.shift.id,
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

  // Aggregate new shifts by (creation-day-NZT + location). A bulk-publish of
  // many shifts on the same day collapses into one feed item.
  type NewShiftEntry = {
    id: string;
    start: Date;
    shiftTypeName: string;
  };
  const newShiftGroups = new Map<
    string,
    {
      location: string;
      shifts: NewShiftEntry[];
      shiftTypeNames: Set<string>;
      earliestStart: Date;
      latestStart: Date;
      earliestCreatedAt: Date;
    }
  >();

  for (const shift of newShifts) {
    if (!shift.location) continue;
    const creationDay = formatInNZT(shift.createdAt, "yyyy-MM-dd");
    const key = `${shift.location}-${creationDay}`;
    const entry: NewShiftEntry = {
      id: shift.id,
      start: shift.start,
      shiftTypeName: shift.shiftType.name,
    };
    const existing = newShiftGroups.get(key);
    if (existing) {
      existing.shifts.push(entry);
      existing.shiftTypeNames.add(shift.shiftType.name);
      if (shift.start < existing.earliestStart)
        existing.earliestStart = shift.start;
      if (shift.start > existing.latestStart)
        existing.latestStart = shift.start;
      if (shift.createdAt < existing.earliestCreatedAt)
        existing.earliestCreatedAt = shift.createdAt;
    } else {
      newShiftGroups.set(key, {
        location: shift.location,
        shifts: [entry],
        shiftTypeNames: new Set([shift.shiftType.name]),
        earliestStart: shift.start,
        latestStart: shift.start,
        earliestCreatedAt: shift.createdAt,
      });
    }
  }

  for (const [key, group] of newShiftGroups) {
    // Preview: soonest 5 shifts by start date, for the feed sheet.
    const preview = [...group.shifts]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 5)
      .map((s) => ({
        id: s.id,
        start: s.start.toISOString(),
        shiftTypeName: s.shiftTypeName,
      }));

    items.push({
      type: "new_shift",
      id: `new-shift-${key}`,
      location: group.location,
      count: group.shifts.length,
      shiftIds: group.shifts.map((s) => s.id),
      shiftTypes: [...group.shiftTypeNames],
      earliestStart: group.earliestStart.toISOString(),
      latestStart: group.latestStart.toISOString(),
      preview,
      timestamp: group.earliestCreatedAt.toISOString(),
      likeCount: 0,
      likedByMe: false,
      recentLikers: [],
      commentCount: 0,
    });
  }

  // Daily menus — one feed item per published menu at the user's location.
  type MenuItem = { name: string; description?: string };
  const extractCourse = (field: unknown): MenuItem[] => {
    if (!Array.isArray(field)) return [];
    const result: MenuItem[] = [];
    for (const raw of field) {
      if (!raw || typeof raw !== "object") continue;
      const obj = raw as { name?: unknown; description?: unknown };
      if (typeof obj.name !== "string" || obj.name.length === 0) continue;
      const entry: MenuItem = { name: obj.name };
      if (typeof obj.description === "string" && obj.description.length > 0) {
        entry.description = obj.description;
      }
      result.push(entry);
    }
    return result;
  };

  for (const menu of dailyMenus) {
    const starter = extractCourse(menu.starter);
    const mains = extractCourse(menu.mains);
    const drink = extractCourse(menu.drink);
    const dessert = extractCourse(menu.dessert);

    if (
      starter.length === 0 &&
      mains.length === 0 &&
      drink.length === 0 &&
      dessert.length === 0 &&
      !menu.announcement
    ) {
      continue;
    }

    items.push({
      type: "daily_menu",
      id: `daily-menu-${menu.id}`,
      menuId: menu.id,
      location: menu.location,
      serviceDate: menu.date.toISOString(),
      chefName: menu.chefName ?? undefined,
      announcement: menu.announcement ?? undefined,
      starter,
      mains,
      drink,
      dessert,
      timestamp: menu.createdAt.toISOString(),
      likeCount: 0,
      likedByMe: false,
      recentLikers: [],
      commentCount: 0,
    });
  }

  // Community events from the marketing CMS. Upcoming events stay in the
  // feed from the moment they're announced until they happen — the app ranks
  // them higher the closer they get (see mobile/lib/feed-ranking.ts) to
  // build hype. For older app versions that sort purely by timestamp, an
  // event still "resurfaces" during the week leading up to it, timestamped
  // so it sorts as if freshly posted. Events aren't location-targeted: with
  // only a handful per year, they're relevant to the whole whānau.
  const startOfTodayNZ = getStartOfDayUTC(now);
  const upcomingEvents = cmsEvents
    .filter((event) => new Date(event.date) >= startOfTodayNZ)
    .slice(0, 10);
  for (const event of upcomingEvents) {
    const eventDate = new Date(event.date);
    const publishedAt = new Date(event.publishedAt);
    const resurfaceAt = new Date(
      eventDate.getTime() - 7 * 24 * 60 * 60 * 1000
    );
    const timestamp =
      resurfaceAt <= now && resurfaceAt > publishedAt
        ? resurfaceAt
        : publishedAt;

    // Events happening today (NZ) are flagged — the app shows a
    // "Happening today" pill for them.
    const isToday = isSameDayInNZT(eventDate, now);

    items.push({
      type: "community_event",
      id: `cms-event-${event.id}`,
      pinned: isToday || undefined,
      title: event.name,
      description: event.shortDescription ?? undefined,
      location: event.location ?? undefined,
      eventDate: event.date,
      displayTime: event.displayTime ?? undefined,
      imageUrl: event.imageUrl ?? undefined,
      url: event.url,
      priceLabel: event.priceLabel ?? undefined,
      ticketUrl: event.ticketUrl ?? undefined,
      timestamp: timestamp.toISOString(),
      likeCount: 0,
      likedByMe: false,
      recentLikers: [],
      commentCount: 0,
    });
  }

  // Journal posts from the marketing CMS. The journal publishes less often
  // than the 14-day feed window turns over, so use a wider 30-day window to
  // keep the latest stories around.
  const journalSince = new Date(now);
  journalSince.setDate(journalSince.getDate() - 30);
  for (const post of cmsJournalPosts
    .filter((p) => new Date(p.publishedAt) >= journalSince)
    .slice(0, 5)) {
    items.push({
      type: "journal_post",
      id: `journal-post-${post.id}`,
      title: post.title,
      summary: post.summary ?? undefined,
      category: post.category ?? undefined,
      imageUrl: post.imageUrl ?? undefined,
      author: post.author ?? undefined,
      url: post.url,
      timestamp: post.publishedAt,
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
    const [recapShifts, mealsServedRecords] = await Promise.all([
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
    ]);

    // Only emit recaps for (location, day) pairs with an explicit MealsServed
    // count — notes-only rows don't give us a number to share.
    const mealsMap = new Map<string, number>();
    for (const record of mealsServedRecords) {
      if (record.mealsServed === null) continue;
      const key = `${record.location}-${record.date.toISOString()}`;
      mealsMap.set(key, record.mealsServed);
    }

    const recapGroups = new Map<
      string,
      {
        location: string;
        displayDate: string;
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
      const meals = mealsMap.get(mealsKey);
      if (meals === undefined) continue;

      const displayDate = formatInNZT(shift.start, "yyyy-MM-dd");
      const groupKey = `${shift.location}-${displayDate}`;

      if (!recapVolunteers.has(groupKey)) {
        recapVolunteers.set(groupKey, new Set());
      }
      const volunteerSet = recapVolunteers.get(groupKey)!;
      for (const s of shift.signups) {
        volunteerSet.add(s.userId);
      }

      const existing = recapGroups.get(groupKey);
      if (existing) {
        existing.volunteerCount = volunteerSet.size;
        if (shift.start > existing.latestStart) {
          existing.latestStart = shift.start;
        }
      } else {
        recapGroups.set(groupKey, {
          location: shift.location,
          displayDate,
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

  if (items.length === 0 && extraIds.length === 0) {
    return NextResponse.json({ items, extraInteractions: {} });
  }

  // Batch-fetch real like/comment data for all items (including client-supplied extras)
  const itemIds = [...items.map((i) => i.id), ...extraIds];

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

  // Build interaction data for client-supplied extra IDs (e.g. dummy photo posts)
  const extraInteractions: Record<
    string,
    {
      likeCount: number;
      likedByMe: boolean;
      commentCount: number;
      recentLikers: Array<{ id: string; name: string; profilePhotoUrl?: string }>;
    }
  > = {};
  for (const id of extraIds) {
    extraInteractions[id] = {
      likeCount: likeCountMap.get(id) ?? 0,
      likedByMe: likedByMeSet.has(id),
      commentCount: commentCountMap.get(id) ?? 0,
      recentLikers: recentLikersMap.get(id) ?? [],
    };
  }

  return NextResponse.json({ items, extraInteractions });
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { cache } from "react";
import { subMonths } from "date-fns";
import type { RecommendedFriend } from "@/lib/friends-utils";
import { getShiftDate, isAMShift } from "@/lib/concurrent-shifts";

// Slot key: same NZ date + same period (Day/Evening) + same location.
// Exported so tests can verify the matching logic directly.
export function getShiftSlotKey(shift: {
  start: Date;
  location: string | null;
}): string {
  const date = getShiftDate(shift.start);
  const period = isAMShift(shift.start) ? "DAY" : "EVE";
  return `${date}|${period}|${shift.location ?? ""}`;
}

export interface Friend {
  friendshipId: string;
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  friendsSince: string;
  friendVisibility: "PUBLIC" | "FRIENDS_ONLY" | "PRIVATE";
}

export interface FriendRequest {
  id: string;
  message: string | null;
  fromUser: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profilePhotoUrl: string | null;
  };
  createdAt: string;
}

export interface FriendsData {
  friends: Friend[];
  pendingRequests: FriendRequest[];
  sentRequests: { id: string; toEmail: string; message: string | null; createdAt: string }[];
}

// Cache the friends data fetching to avoid duplicate database calls
export const getFriendsData = cache(async (): Promise<FriendsData | null> => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return null;
  }

  try {
    // Get user's friends (accepted friendships)
    const friends = await prisma.friendship.findMany({
      where: {
        AND: [
          {
            OR: [{ userId: user.id }, { friendId: user.id }],
          },
          { status: "ACCEPTED" },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePhotoUrl: true,
            friendVisibility: true,
          },
        },
        friend: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePhotoUrl: true,
            friendVisibility: true,
          },
        },
      },
    });

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
      select: {
        id: true,
        toEmail: true,
        message: true,
        createdAt: true,
      },
    });

    // Format friends list - get the other person in the friendship
    // Use a Map to deduplicate friends by their ID
    const friendsMap = new Map();
    
    friends.forEach((friendship) => {
      const friend =
        friendship.userId === user.id ? friendship.friend : friendship.user;
      
      // Only add if we haven't seen this friend before, or if this friendship is older
      if (!friendsMap.has(friend.id) || friendship.createdAt.toISOString() < friendsMap.get(friend.id).friendsSince) {
        friendsMap.set(friend.id, {
          friendshipId: friendship.id,
          id: friend.id,
          name: friend.name,
          firstName: friend.firstName,
          lastName: friend.lastName,
          email: friend.email,
          profilePhotoUrl: friend.profilePhotoUrl,
          friendsSince: friendship.createdAt.toISOString(),
          friendVisibility: friend.friendVisibility || "PUBLIC",
        });
      }
    });
    
    const formattedFriends = Array.from(friendsMap.values());

    return {
      friends: formattedFriends,
      pendingRequests: pendingRequests.map(req => ({
        ...req,
        createdAt: req.createdAt.toISOString(),
      })),
      sentRequests: sentRequests.map(req => ({
        ...req,
        createdAt: req.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Error fetching friends data:", error);
    return {
      friends: [],
      pendingRequests: [],
      sentRequests: [],
    };
  }
});

const SHARED_SHIFTS_THRESHOLD = 3;
const MONTHS_TO_LOOK_BACK = 3;

/**
 * Core recommended-friends algorithm. Auth-agnostic so it can be reused by
 * both the NextAuth web flow and the JWT-authenticated mobile API.
 *
 * A "shared shift" means both users were at the same location during the
 * same NZ-time day/evening period — they don't need to have been on the
 * exact same shift.
 */
export async function getRecommendedFriendsForUser(
  userId: string,
  userEmail: string
): Promise<RecommendedFriend[]> {
  try {
    const cutoffDate = subMonths(new Date(), MONTHS_TO_LOOK_BACK);

    const userShifts = await prisma.signup.findMany({
      where: {
        userId,
        status: "CONFIRMED",
        shift: { start: { gte: cutoffDate } },
      },
      select: {
        shift: { select: { start: true, location: true } },
      },
    });

    if (userShifts.length === 0) {
      return [];
    }

    // Build the set of slots the current user attended (date + day/evening + location).
    const userSlotKeys = new Set<string>();
    const userLocations = new Set<string>();
    let userHasNullLocation = false;
    for (const signup of userShifts) {
      userSlotKeys.add(getShiftSlotKey(signup.shift));
      if (signup.shift.location === null) {
        userHasNullLocation = true;
      } else {
        userLocations.add(signup.shift.location);
      }
    }

    const existingFriends = await prisma.friendship.findMany({
      where: {
        OR: [{ userId }, { friendId: userId }],
        status: "ACCEPTED",
      },
      select: { userId: true, friendId: true },
    });

    const friendIds = existingFriends.map((f) =>
      f.userId === userId ? f.friendId : f.userId
    );

    // Get sent friend requests (to exclude from suggestions)
    const sentRequests = await prisma.friendRequest.findMany({
      where: {
        fromUserId: userId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: { toEmail: true },
    });

    const sentRequestEmails = sentRequests.map((req) => req.toEmail);

    // Get received friend requests (to include in suggestions)
    const receivedRequests = await prisma.friendRequest.findMany({
      where: {
        toEmail: userEmail,
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

    // Narrow the candidate pool to signups whose shift could match one of our
    // slots: same date range + same location set. We then filter precisely by
    // slot key in memory.
    const locationFilter: Array<{ location: string | null } | { location: { in: string[] } }> = [];
    if (userLocations.size > 0) {
      locationFilter.push({ location: { in: [...userLocations] } });
    }
    if (userHasNullLocation) {
      locationFilter.push({ location: null });
    }

    const sharedSignups = await prisma.signup.findMany({
      where: {
        userId: { not: userId },
        status: "CONFIRMED",
        shift: {
          start: { gte: cutoffDate },
          ...(locationFilter.length === 1
            ? locationFilter[0]
            : { OR: locationFilter }),
        },
        user: {
          allowFriendSuggestions: true,
          archivedAt: null,
          id: { notIn: friendIds },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePhotoUrl: true,
          },
        },
        shift: {
          select: {
            id: true,
            start: true,
            shiftType: { select: { name: true } },
            location: true,
          },
        },
      },
    });

    // Aggregate by user, counting distinct shared slots. We keep one
    // representative shift per slot (the other user's shift) so the UI can
    // show what they typically work.
    const userShiftCounts = new Map<
      string,
      {
        user: (typeof sharedSignups)[0]["user"];
        shiftsBySlot: Map<string, (typeof sharedSignups)[0]["shift"]>;
      }
    >();

    sharedSignups.forEach((signup) => {
      const slotKey = getShiftSlotKey(signup.shift);
      if (!userSlotKeys.has(slotKey)) {
        return;
      }

      // Only exclude users we've sent requests to, not users who sent requests to us
      if (sentRequestEmails.includes(signup.user.email)) {
        return;
      }

      const candidateUserId = signup.user.id;
      if (!userShiftCounts.has(candidateUserId)) {
        userShiftCounts.set(candidateUserId, {
          user: signup.user,
          shiftsBySlot: new Map(),
        });
      }

      const entry = userShiftCounts.get(candidateUserId)!;
      const existing = entry.shiftsBySlot.get(slotKey);
      // Prefer the most recent shift in the slot as the representative
      if (!existing || signup.shift.start.getTime() > existing.start.getTime()) {
        entry.shiftsBySlot.set(slotKey, signup.shift);
      }
    });

    const collectRecentSharedShifts = (
      shiftsBySlot: Map<string, (typeof sharedSignups)[0]["shift"]> | undefined
    ) =>
      Array.from(shiftsBySlot?.values() ?? [])
        .sort((a, b) => b.start.getTime() - a.start.getTime())
        .slice(0, 3)
        .map((shift) => ({
          id: shift.id,
          start: shift.start.toISOString(),
          shiftTypeName: shift.shiftType.name,
          location: shift.location,
        }));

    // Map received friend requests to RecommendedFriend format
    const friendRequestSuggestions: RecommendedFriend[] = receivedRequests.map((req) => {
      const data = userShiftCounts.get(req.fromUser.id);
      return {
        id: req.fromUser.id,
        name: req.fromUser.name,
        firstName: req.fromUser.firstName,
        lastName: req.fromUser.lastName,
        profilePhotoUrl: req.fromUser.profilePhotoUrl,
        sharedShiftsCount: data?.shiftsBySlot.size ?? 0,
        recentSharedShifts: collectRecentSharedShifts(data?.shiftsBySlot),
        isPendingRequest: true,
        requestId: req.id,
      };
    });

    // Get shared-shift based suggestions (exclude users who sent friend requests)
    const receivedRequestUserIds = receivedRequests.map((req) => req.fromUser.id);
    const sharedShiftSuggestions: RecommendedFriend[] = Array.from(userShiftCounts.entries())
      .filter(([candidateUserId, data]) =>
        data.shiftsBySlot.size >= SHARED_SHIFTS_THRESHOLD &&
        !receivedRequestUserIds.includes(candidateUserId)
      )
      .map(([, data]) => ({
        id: data.user.id,
        name: data.user.name,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        profilePhotoUrl: data.user.profilePhotoUrl,
        sharedShiftsCount: data.shiftsBySlot.size,
        recentSharedShifts: collectRecentSharedShifts(data.shiftsBySlot),
        isPendingRequest: false,
      }))
      .sort((a, b) => b.sharedShiftsCount - a.sharedShiftsCount);

    // Combine friend requests (prioritized) with shared-shift suggestions
    return [...friendRequestSuggestions, ...sharedShiftSuggestions];
  } catch (error) {
    console.error("Error fetching recommended friends:", error);
    return [];
  }
}

// Fetch recommended friends based on shared shifts (web NextAuth session)
export const getRecommendedFriends = cache(async (): Promise<RecommendedFriend[]> => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return [];
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true },
  });

  if (!user) {
    return [];
  }

  return getRecommendedFriendsForUser(user.id, user.email);
});

// Get current user for server components
export const getCurrentUser = cache(async () => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return null;
  }

  return await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      profilePhotoUrl: true,
      friendVisibility: true,
      allowFriendRequests: true,
    },
  });
});
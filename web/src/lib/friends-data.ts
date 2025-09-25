import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { cache } from "react";

export interface Friend {
  friendshipId: string;
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  friendsSince: string;
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
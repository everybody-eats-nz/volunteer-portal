"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createFriendRequestNotification,
  createFriendRequestAcceptedNotification,
} from "@/lib/notifications";

const sendFriendRequestSchema = z.object({
  email: z.string().email("Invalid email format"),
  message: z.string().optional(),
});

const privacySettingsSchema = z.object({
  friendVisibility: z.enum(["PUBLIC", "FRIENDS_ONLY", "PRIVATE"]),
  allowFriendRequests: z.boolean(),
});

export async function sendFriendRequest(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return { error: "User not found" };
  }

  try {
    const email = formData.get("email") as string;
    const message = formData.get("message") as string;

    const validation = sendFriendRequestSchema.safeParse({ email, message });
    if (!validation.success) {
      return { error: "Invalid input data" };
    }

    const { email: validatedEmail, message: validatedMessage } = validation.data;

    // Check if trying to add themselves
    if (validatedEmail === user.email) {
      return { error: "Cannot send friend request to yourself" };
    }

    // Check if user allows friend requests
    const targetUser = await prisma.user.findUnique({
      where: { email: validatedEmail },
      select: { id: true, allowFriendRequests: true, name: true },
    });

    if (!targetUser) {
      return { error: "User not found" };
    }

    if (!targetUser.allowFriendRequests) {
      return { error: "User is not accepting friend requests" };
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId: targetUser.id },
          { userId: targetUser.id, friendId: user.id },
        ],
      },
    });

    if (existingFriendship) {
      return { error: "Friendship already exists or is pending" };
    }

    // Check if friend request already exists (any status)
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        fromUserId: user.id,
        toEmail: validatedEmail,
      },
    });

    // Calculate new expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    let friendRequest;

    if (existingRequest) {
      // If there's a pending request that hasn't expired, don't allow resending
      if (existingRequest.status === "PENDING" && existingRequest.expiresAt > new Date()) {
        return { error: "Friend request already sent" };
      }

      // If request was previously accepted, declined, expired, or canceled, update it
      // This handles the case where users removed each other as friends and want to reconnect
      friendRequest = await prisma.friendRequest.update({
        where: { id: existingRequest.id },
        data: {
          status: "PENDING",
          message: validatedMessage || null,
          expiresAt,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new friend request
      friendRequest = await prisma.friendRequest.create({
        data: {
          fromUserId: user.id,
          toEmail: validatedEmail,
          message: validatedMessage || null,
          expiresAt,
        },
      });
    }

    // Create notification for the target user
    try {
      const senderName =
        user.name ||
        (user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email);

      await createFriendRequestNotification(
        targetUser.id,
        senderName,
        friendRequest.id
      );
    } catch (notificationError) {
      // Don't fail the friend request if notification creation fails
      console.error("Error creating friend request notification:", notificationError);
    }

    revalidatePath("/friends");
    return { success: "Friend request sent successfully" };
  } catch (error) {
    console.error("Error sending friend request:", error);
    return { error: "Internal server error" };
  }
}

export async function acceptFriendRequest(requestId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return { error: "User not found" };
  }

  try {
    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        fromUser: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!friendRequest) {
      return { error: "Friend request not found" };
    }

    // Verify this request is for the current user
    if (friendRequest.toEmail !== user.email) {
      return { error: "Unauthorized to accept this request" };
    }

    // Check if request is still pending
    if (friendRequest.status !== "PENDING") {
      return { error: "Friend request is no longer pending" };
    }

    // Use a transaction to create bidirectional friendship and update request
    const result = await prisma.$transaction(async (tx) => {
      // Create bidirectional friendship records
      const friendship1 = await tx.friendship.create({
        data: {
          userId: user.id,
          friendId: friendRequest.fromUser.id,
          status: "ACCEPTED",
          initiatedBy: friendRequest.fromUser.id,
        },
      });

      const friendship2 = await tx.friendship.create({
        data: {
          userId: friendRequest.fromUser.id,
          friendId: user.id,
          status: "ACCEPTED",
          initiatedBy: friendRequest.fromUser.id,
        },
      });

      // Update friend request status
      await tx.friendRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      });

      return { friendship1, friendship2 };
    });

    // Create notification for the requester about acceptance
    try {
      const accepterName =
        user.name ||
        (user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email);

      await createFriendRequestAcceptedNotification(
        friendRequest.fromUserId,
        accepterName,
        result.friendship1.id
      );
    } catch (notificationError) {
      // Don't fail the acceptance if notification creation fails
      console.error("Error creating friend request accepted notification:", notificationError);
    }

    revalidatePath("/friends");
    return { success: "Friend request accepted" };
  } catch (error) {
    console.error("Error accepting friend request:", error);
    return { error: "Internal server error" };
  }
}

export async function declineFriendRequest(requestId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return { error: "User not found" };
  }

  try {
    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest) {
      return { error: "Friend request not found" };
    }

    // Verify this request is for the current user
    if (friendRequest.toEmail !== user.email) {
      return { error: "Unauthorized to decline this request" };
    }

    // Check if request is still pending
    if (friendRequest.status !== "PENDING") {
      return { error: "Friend request is no longer pending" };
    }

    // Update friend request status to declined
    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: "DECLINED" },
    });

    revalidatePath("/friends");
    return { success: "Friend request declined" };
  } catch (error) {
    console.error("Error declining friend request:", error);
    return { error: "Internal server error" };
  }
}

export async function sendFriendRequestByUserId(userId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return { error: "User not found" };
  }

  try {
    // Check if trying to add themselves
    if (userId === user.id) {
      return { error: "Cannot send friend request to yourself" };
    }

    // Check if user allows friend requests
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        allowFriendRequests: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!targetUser) {
      return { error: "User not found" };
    }

    if (!targetUser.allowFriendRequests) {
      return { error: "User is not accepting friend requests" };
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId: targetUser.id },
          { userId: targetUser.id, friendId: user.id },
        ],
      },
    });

    if (existingFriendship) {
      return { error: "Friendship already exists or is pending" };
    }

    // Check if friend request already exists (any status)
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        fromUserId: user.id,
        toEmail: targetUser.email,
      },
    });

    // Calculate new expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    let friendRequest;

    if (existingRequest) {
      // If there's a pending request that hasn't expired, don't allow resending
      if (existingRequest.status === "PENDING" && existingRequest.expiresAt > new Date()) {
        return { error: "Friend request already sent" };
      }

      // If request was previously accepted, declined, expired, or canceled, update it
      // This handles the case where users removed each other as friends and want to reconnect
      friendRequest = await prisma.friendRequest.update({
        where: { id: existingRequest.id },
        data: {
          status: "PENDING",
          message: null, // No message for suggested friends
          expiresAt,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new friend request
      friendRequest = await prisma.friendRequest.create({
        data: {
          fromUserId: user.id,
          toEmail: targetUser.email,
          message: null, // No message for suggested friends
          expiresAt,
        },
      });
    }

    // Create notification for the target user
    try {
      const senderName =
        user.name ||
        (user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email);

      await createFriendRequestNotification(
        targetUser.id,
        senderName,
        friendRequest.id
      );
    } catch (notificationError) {
      // Don't fail the friend request if notification creation fails
      console.error("Error creating friend request notification:", notificationError);
    }

    revalidatePath("/friends");
    return { success: "Friend request sent successfully" };
  } catch (error) {
    console.error("Error sending friend request:", error);
    return { error: "Internal server error" };
  }
}

export async function removeFriend(friendId: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return { error: "User not found" };
  }

  try {
    // Remove both directions of the friendship
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: user.id, friendId },
          { userId: friendId, friendId: user.id },
        ],
        status: "ACCEPTED",
      },
    });

    revalidatePath("/friends");
    return { success: "Friend removed successfully" };
  } catch (error) {
    console.error("Error removing friend:", error);
    return { error: "Internal server error" };
  }
}

export async function updatePrivacySettings(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return { error: "User not found" };
  }

  try {
    const friendVisibility = formData.get("friendVisibility") as string;
    const allowFriendRequests = formData.get("allowFriendRequests") === "true";

    const validation = privacySettingsSchema.safeParse({
      friendVisibility,
      allowFriendRequests,
    });

    if (!validation.success) {
      return { error: "Invalid privacy settings" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        friendVisibility: validation.data.friendVisibility,
        allowFriendRequests: validation.data.allowFriendRequests,
      },
    });

    revalidatePath("/friends");
    return { success: "Privacy settings updated" };
  } catch (error) {
    console.error("Error updating privacy settings:", error);
    return { error: "Internal server error" };
  }
}
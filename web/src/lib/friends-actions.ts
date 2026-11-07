"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createFriendRequestAcceptedNotification } from "@/lib/notifications";
import {
  FRIEND_REQUEST_MESSAGE_MAX_LENGTH,
  sendFriendRequestFromUserToEmail,
  sendFriendRequestFromUserToUser,
} from "@/lib/friend-request-service";

const sendFriendRequestSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  message: z
    .string()
    .trim()
    .max(
      FRIEND_REQUEST_MESSAGE_MAX_LENGTH,
      `Keep your message under ${FRIEND_REQUEST_MESSAGE_MAX_LENGTH} characters`
    )
    .optional(),
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
    select: { id: true },
  });

  if (!user) {
    return { error: "User not found" };
  }

  const validation = sendFriendRequestSchema.safeParse({
    email: formData.get("email"),
    message: formData.get("message") || undefined,
  });
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  try {
    const result = await sendFriendRequestFromUserToEmail(
      user.id,
      validation.data.email,
      { message: validation.data.message }
    );
    if (!result.ok) {
      return { error: result.error };
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
        result.friendship1.id,
        user.id
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
    select: { id: true },
  });

  if (!user) {
    return { error: "User not found" };
  }

  const result = await sendFriendRequestFromUserToUser(user.id, userId);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/friends");
  return { success: "Friend request sent successfully" };
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
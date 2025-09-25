"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

    // Check if friend request already exists
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        fromUserId: user.id,
        toEmail: validatedEmail,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingRequest) {
      return { error: "Friend request already sent" };
    }

    // Create friend request
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    await prisma.friendRequest.create({
      data: {
        fromUserId: user.id,
        toEmail: validatedEmail,
        message: validatedMessage || null,
        expiresAt,
      },
    });

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
          select: { id: true, email: true, name: true },
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
    await prisma.$transaction(async (tx) => {
      // Create bidirectional friendship records
      await tx.friendship.create({
        data: {
          userId: user.id,
          friendId: friendRequest.fromUser.id,
          status: "ACCEPTED",
          initiatedBy: friendRequest.fromUser.id,
        },
      });

      await tx.friendship.create({
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
    });

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
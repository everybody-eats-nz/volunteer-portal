import { prisma } from "@/lib/prisma";
import { createFriendRequestNotification } from "@/lib/notifications";

type SendResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string; status: number };

const REQUEST_EXPIRY_DAYS = 30;

/**
 * Shared core for "send friend request by userId" — used by both the web
 * server action (`sendFriendRequestByUserId`) and the mobile API route
 * (`POST /api/mobile/friends/requests`). Auth-agnostic: callers are
 * responsible for resolving the authenticated `fromUserId`.
 */
export async function sendFriendRequestFromUserToUser(
  fromUserId: string,
  toUserId: string
): Promise<SendResult> {
  if (fromUserId === toUserId) {
    return {
      ok: false,
      error: "Cannot send friend request to yourself",
      status: 400,
    };
  }

  const fromUser = await prisma.user.findUnique({
    where: { id: fromUserId },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!fromUser) {
    return { ok: false, error: "Sender not found", status: 404 };
  }

  const toUser = await prisma.user.findUnique({
    where: { id: toUserId },
    select: {
      id: true,
      email: true,
      allowFriendRequests: true,
    },
  });

  if (!toUser) {
    return { ok: false, error: "User not found", status: 404 };
  }

  if (!toUser.allowFriendRequests) {
    return {
      ok: false,
      error: "User is not accepting friend requests",
      status: 403,
    };
  }

  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: fromUser.id, friendId: toUser.id },
        { userId: toUser.id, friendId: fromUser.id },
      ],
    },
  });

  if (existingFriendship) {
    return {
      ok: false,
      error: "Friendship already exists or is pending",
      status: 409,
    };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REQUEST_EXPIRY_DAYS);

  const existingRequest = await prisma.friendRequest.findFirst({
    where: { fromUserId: fromUser.id, toEmail: toUser.email },
  });

  let friendRequest;
  if (existingRequest) {
    if (
      existingRequest.status === "PENDING" &&
      existingRequest.expiresAt > new Date()
    ) {
      return {
        ok: false,
        error: "Friend request already sent",
        status: 409,
      };
    }

    friendRequest = await prisma.friendRequest.update({
      where: { id: existingRequest.id },
      data: {
        status: "PENDING",
        message: null,
        expiresAt,
        updatedAt: new Date(),
      },
    });
  } else {
    friendRequest = await prisma.friendRequest.create({
      data: {
        fromUserId: fromUser.id,
        toEmail: toUser.email,
        message: null,
        expiresAt,
      },
    });
  }

  try {
    const senderName =
      fromUser.name ||
      (fromUser.firstName && fromUser.lastName
        ? `${fromUser.firstName} ${fromUser.lastName}`
        : fromUser.email);

    await createFriendRequestNotification(
      toUser.id,
      senderName,
      friendRequest.id,
      fromUser.id
    );
  } catch (notificationError) {
    console.error(
      "Error creating friend request notification:",
      notificationError
    );
  }

  return { ok: true, requestId: friendRequest.id };
}

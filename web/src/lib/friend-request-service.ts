import { prisma } from "@/lib/prisma";
import { createFriendRequestNotification } from "@/lib/notifications";
import { emailMatches, insensitiveEquals } from "@/lib/utils/email";

export type SendFriendRequestResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string; status: number };

type SendOptions = {
  /** Optional personal note shown with the request. */
  message?: string | null;
};

const REQUEST_EXPIRY_DAYS = 30;

/** Longest personal message a friend request may carry. */
export const FRIEND_REQUEST_MESSAGE_MAX_LENGTH = 500;

/**
 * Shared core for sending a friend request to a known user. Used by the web
 * server actions, the web and mobile API routes, and the email variant below.
 * Auth-agnostic: callers are responsible for resolving the authenticated
 * `fromUserId`.
 */
export async function sendFriendRequestFromUserToUser(
  fromUserId: string,
  toUserId: string,
  { message }: SendOptions = {}
): Promise<SendFriendRequestResult> {
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

  // Requests are stored against the recipient's stored email, which is what
  // their pending-requests lookups match exactly. Older rows from the web form
  // kept the casing the sender typed, so find those too and prefer an exact
  // match. A row with other casing is invisible to the recipient, so it is
  // revived under the stored casing rather than counted as already sent.
  // Picking it only when no exact row exists keeps the rewrite clear of the
  // (fromUserId, toEmail) unique constraint.
  const sentRequests = await prisma.friendRequest.findMany({
    where: {
      fromUserId: fromUser.id,
      toEmail: insensitiveEquals(toUser.email),
    },
  });
  const existingRequest =
    sentRequests.find((r) => r.toEmail === toUser.email) ?? sentRequests[0];

  let friendRequest;
  if (existingRequest) {
    if (
      existingRequest.toEmail === toUser.email &&
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
        toEmail: toUser.email,
        status: "PENDING",
        message: message || null,
        expiresAt,
        updatedAt: new Date(),
      },
    });
  } else {
    friendRequest = await prisma.friendRequest.create({
      data: {
        fromUserId: fromUser.id,
        toEmail: toUser.email,
        message: message || null,
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

/**
 * Send a friend request to whoever signed up with `email`, for adding a
 * volunteer who isn't among your suggestions. Stored emails are mixed-case,
 * so the match is case-insensitive; if two accounts differ only by case the
 * oldest wins, the same account sign-in picks.
 */
export async function sendFriendRequestFromUserToEmail(
  fromUserId: string,
  email: string,
  options: SendOptions = {}
): Promise<SendFriendRequestResult> {
  const toUser = await prisma.user.findFirst({
    where: emailMatches(email),
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!toUser) {
    return {
      ok: false,
      error: "No volunteer has signed up with that email",
      status: 404,
    };
  }

  return sendFriendRequestFromUserToUser(fromUserId, toUser.id, options);
}

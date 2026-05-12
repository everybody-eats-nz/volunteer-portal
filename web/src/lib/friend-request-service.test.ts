import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    friendship: { findFirst: vi.fn() },
    friendRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createFriendRequestNotification: vi.fn().mockResolvedValue(undefined),
}));

import { sendFriendRequestFromUserToUser } from "./friend-request-service";
import { prisma } from "./prisma";

type Mock = ReturnType<typeof vi.fn>;
const userFind = prisma.user.findUnique as unknown as Mock;
const friendshipFind = prisma.friendship.findFirst as unknown as Mock;
const requestFind = prisma.friendRequest.findFirst as unknown as Mock;
const requestCreate = prisma.friendRequest.create as unknown as Mock;
const requestUpdate = prisma.friendRequest.update as unknown as Mock;

const sender = {
  id: "sender-1",
  email: "sender@example.com",
  name: "Sender",
  firstName: "Send",
  lastName: "Er",
};

const recipient = {
  id: "recipient-1",
  email: "recipient@example.com",
  allowFriendRequests: true,
};

describe("sendFriendRequestFromUserToUser", () => {
  beforeEach(() => {
    userFind.mockReset();
    friendshipFind.mockReset();
    requestFind.mockReset();
    requestCreate.mockReset();
    requestUpdate.mockReset();
  });

  it("rejects self-friend requests without hitting the database", async () => {
    const result = await sendFriendRequestFromUserToUser("user1", "user1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Cannot send friend request to yourself");
    expect(result.status).toBe(400);
    expect(userFind).not.toHaveBeenCalled();
  });

  it("returns 404 when the sender is missing", async () => {
    userFind.mockResolvedValueOnce(null); // sender lookup

    const result = await sendFriendRequestFromUserToUser("missing", "other");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Sender not found");
    expect(result.status).toBe(404);
  });

  it("returns 404 when the recipient is missing", async () => {
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(null);

    const result = await sendFriendRequestFromUserToUser(sender.id, "ghost");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("User not found");
    expect(result.status).toBe(404);
  });

  it("returns 403 when the recipient has friend requests disabled", async () => {
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce({ ...recipient, allowFriendRequests: false });

    const result = await sendFriendRequestFromUserToUser(
      sender.id,
      recipient.id
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("User is not accepting friend requests");
    expect(result.status).toBe(403);
  });

  it("returns 409 when an active friendship already exists", async () => {
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(recipient);
    friendshipFind.mockResolvedValueOnce({ id: "f1" });

    const result = await sendFriendRequestFromUserToUser(
      sender.id,
      recipient.id
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Friendship already exists or is pending");
    expect(result.status).toBe(409);
  });

  it("returns 409 when a pending unexpired request already exists", async () => {
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(recipient);
    friendshipFind.mockResolvedValueOnce(null);
    requestFind.mockResolvedValueOnce({
      id: "r1",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const result = await sendFriendRequestFromUserToUser(
      sender.id,
      recipient.id
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Friend request already sent");
    expect(result.status).toBe(409);
    expect(requestCreate).not.toHaveBeenCalled();
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("revives a previously declined/expired request rather than creating a duplicate", async () => {
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(recipient);
    friendshipFind.mockResolvedValueOnce(null);
    requestFind.mockResolvedValueOnce({
      id: "r-old",
      status: "DECLINED",
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    requestUpdate.mockResolvedValueOnce({ id: "r-old" });

    const result = await sendFriendRequestFromUserToUser(
      sender.id,
      recipient.id
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.requestId).toBe("r-old");
    expect(requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r-old" },
        data: expect.objectContaining({ status: "PENDING" }),
      })
    );
    expect(requestCreate).not.toHaveBeenCalled();
  });

  it("creates a new request when none exists and returns the new id", async () => {
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(recipient);
    friendshipFind.mockResolvedValueOnce(null);
    requestFind.mockResolvedValueOnce(null);
    requestCreate.mockResolvedValueOnce({ id: "r-new" });

    const result = await sendFriendRequestFromUserToUser(
      sender.id,
      recipient.id
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.requestId).toBe("r-new");
    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromUserId: sender.id,
          toEmail: recipient.email,
        }),
      })
    );
  });

  it("still succeeds when the notification helper throws (notifications are best-effort)", async () => {
    const { createFriendRequestNotification } = await import(
      "@/lib/notifications"
    );
    (createFriendRequestNotification as unknown as Mock).mockRejectedValueOnce(
      new Error("notif down")
    );

    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(recipient);
    friendshipFind.mockResolvedValueOnce(null);
    requestFind.mockResolvedValueOnce(null);
    requestCreate.mockResolvedValueOnce({ id: "r-new" });

    const result = await sendFriendRequestFromUserToUser(
      sender.id,
      recipient.id
    );

    expect(result.ok).toBe(true);
  });
});

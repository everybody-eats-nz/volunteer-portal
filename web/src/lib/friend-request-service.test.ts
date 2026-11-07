import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    friendship: { findFirst: vi.fn() },
    friendRequest: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createFriendRequestNotification: vi.fn().mockResolvedValue(undefined),
}));

import {
  sendFriendRequestFromUserToEmail,
  sendFriendRequestFromUserToUser,
} from "./friend-request-service";
import { prisma } from "./prisma";

type Mock = ReturnType<typeof vi.fn>;
const userFind = prisma.user.findUnique as unknown as Mock;
const userFindFirst = prisma.user.findFirst as unknown as Mock;
const friendshipFind = prisma.friendship.findFirst as unknown as Mock;
const requestFind = prisma.friendRequest.findMany as unknown as Mock;
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
    requestFind.mockResolvedValueOnce([
      {
        id: "r1",
        toEmail: recipient.email,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    ]);

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
    requestFind.mockResolvedValueOnce([
      {
        id: "r-old",
        toEmail: recipient.email,
        status: "DECLINED",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ]);
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

  it("looks up earlier requests case-insensitively", async () => {
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(recipient);
    friendshipFind.mockResolvedValueOnce(null);
    requestFind.mockResolvedValueOnce([]);
    requestCreate.mockResolvedValueOnce({ id: "r-new" });

    await sendFriendRequestFromUserToUser(sender.id, recipient.id);

    expect(requestFind).toHaveBeenCalledWith({
      where: {
        fromUserId: sender.id,
        toEmail: { equals: recipient.email, mode: "insensitive" },
      },
    });
  });

  it("re-sends a pending request stored under other casing, fixing its casing", async () => {
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(recipient);
    friendshipFind.mockResolvedValueOnce(null);
    // A legacy row from the old web form, which kept the typed casing. The
    // recipient's lookups match toEmail exactly, so they never saw it.
    requestFind.mockResolvedValueOnce([
      {
        id: "r-legacy",
        toEmail: "Recipient@Example.com",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    ]);
    requestUpdate.mockResolvedValueOnce({ id: "r-legacy" });

    const result = await sendFriendRequestFromUserToUser(
      sender.id,
      recipient.id
    );

    expect(result).toEqual({ ok: true, requestId: "r-legacy" });
    expect(requestUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r-legacy" },
        data: expect.objectContaining({
          toEmail: recipient.email,
          status: "PENDING",
        }),
      })
    );
    expect(requestCreate).not.toHaveBeenCalled();
  });

  it("prefers the exact-casing request over a legacy one", async () => {
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(recipient);
    friendshipFind.mockResolvedValueOnce(null);
    requestFind.mockResolvedValueOnce([
      {
        id: "r-legacy",
        toEmail: "RECIPIENT@example.com",
        status: "DECLINED",
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        id: "r-exact",
        toEmail: recipient.email,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    ]);

    const result = await sendFriendRequestFromUserToUser(
      sender.id,
      recipient.id
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(409);
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it("creates a new request when none exists and returns the new id", async () => {
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(recipient);
    friendshipFind.mockResolvedValueOnce(null);
    requestFind.mockResolvedValueOnce([]);
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
    requestFind.mockResolvedValueOnce([]);
    requestCreate.mockResolvedValueOnce({ id: "r-new" });

    const result = await sendFriendRequestFromUserToUser(
      sender.id,
      recipient.id
    );

    expect(result.ok).toBe(true);
  });
});

describe("sendFriendRequestFromUserToEmail", () => {
  beforeEach(() => {
    userFind.mockReset();
    userFindFirst.mockReset();
    friendshipFind.mockReset();
    requestFind.mockReset();
    requestCreate.mockReset();
    requestUpdate.mockReset();
  });

  it("matches the email case-insensitively, oldest account first", async () => {
    userFindFirst.mockResolvedValueOnce(null);

    await sendFriendRequestFromUserToEmail(sender.id, "  Recipient@Example.COM ");

    expect(userFindFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: "recipient@example.com", mode: "insensitive" },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  });

  it("returns 404 when nobody has signed up with the email", async () => {
    userFindFirst.mockResolvedValueOnce(null);

    const result = await sendFriendRequestFromUserToEmail(
      sender.id,
      "nobody@example.com"
    );

    expect(result).toEqual({
      ok: false,
      error: "No volunteer has signed up with that email",
      status: 404,
    });
    expect(requestCreate).not.toHaveBeenCalled();
  });

  it("rejects the sender's own email", async () => {
    userFindFirst.mockResolvedValueOnce({ id: sender.id });

    const result = await sendFriendRequestFromUserToEmail(
      sender.id,
      sender.email
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Cannot send friend request to yourself");
  });

  it("sends to the matched user with the stored email and the message", async () => {
    userFindFirst.mockResolvedValueOnce({ id: recipient.id });
    userFind.mockResolvedValueOnce(sender);
    userFind.mockResolvedValueOnce(recipient);
    friendshipFind.mockResolvedValueOnce(null);
    requestFind.mockResolvedValueOnce([]);
    requestCreate.mockResolvedValueOnce({ id: "r-email" });

    const result = await sendFriendRequestFromUserToEmail(
      sender.id,
      "RECIPIENT@example.com",
      { message: "Kia ora!" }
    );

    expect(result).toEqual({ ok: true, requestId: "r-email" });
    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromUserId: sender.id,
          // The recipient's stored email, so their pending-requests lookup
          // (exact match on toEmail) finds it whatever casing was typed.
          toEmail: recipient.email,
          message: "Kia ora!",
        }),
      })
    );
  });
});

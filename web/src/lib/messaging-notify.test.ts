import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
  },
}));

vi.mock("./notification-sse-manager", () => ({
  notificationSSEManager: {
    broadcastToAdmins: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("./services/expo-push", () => ({
  sendPushToUsers: vi.fn().mockResolvedValue(undefined),
}));

// broadcastNewMessageToAdmins doesn't use createNotification, but the module
// imports it — stub it so we don't pull in the real notifications graph.
vi.mock("./notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

import { broadcastNewMessageToAdmins } from "./messaging-notify";
import { prisma } from "./prisma";
import { notificationSSEManager } from "./notification-sse-manager";
import { sendPushToUsers } from "./services/expo-push";

type Mock = ReturnType<typeof vi.fn>;
const userFindMany = prisma.user.findMany as unknown as Mock;
const broadcast = notificationSSEManager.broadcastToAdmins as unknown as Mock;
const pushToUsers = sendPushToUsers as unknown as Mock;

function args(overrides: Record<string, unknown> = {}) {
  return {
    threadId: "thread-1",
    message: {
      id: "msg-1",
      body: "Hello team",
      senderId: "vol-1",
      senderRole: "VOLUNTEER" as const,
      createdAt: new Date("2026-07-01T02:00:00.000Z"),
    },
    volunteer: {
      id: "vol-1",
      firstName: "Sam",
      lastName: "Lee",
      name: null,
      email: "sam@example.com",
    },
    ...overrides,
  };
}

describe("broadcastNewMessageToAdmins", () => {
  beforeEach(() => {
    userFindMany.mockReset().mockResolvedValue([]);
    broadcast.mockReset().mockResolvedValue(undefined);
    pushToUsers.mockReset().mockResolvedValue(undefined);
  });

  it("always broadcasts the message to admins over SSE", async () => {
    await broadcastNewMessageToAdmins(args());

    expect(broadcast).toHaveBeenCalledTimes(1);
    const payload = broadcast.mock.calls[0][0];
    expect(payload.data.notification.kind).toBe("direct_message");
    expect(payload.data.notification.threadId).toBe("thread-1");
    expect(payload.data.notification.volunteer.name).toBe("Sam Lee");
  });

  it("pushes only to opted-in admins, excluding the sender", async () => {
    userFindMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);

    await broadcastNewMessageToAdmins(args());

    expect(userFindMany).toHaveBeenCalledWith({
      where: {
        role: "ADMIN",
        adminMessageNotifications: true,
        id: { not: "vol-1" },
      },
      select: { id: true },
    });

    expect(pushToUsers).toHaveBeenCalledTimes(1);
    const [ids, payload] = pushToUsers.mock.calls[0];
    expect(ids).toEqual(["admin-1", "admin-2"]);
    expect(payload.title).toBe("Sam Lee messaged the team");
    expect(payload.body).toBe("Hello team");
    expect(payload.data).toMatchObject({
      type: "DIRECT_MESSAGE_ADMIN",
      threadId: "thread-1",
      actionUrl: "/admin/messages",
    });
    // Intentionally no badge — admins track message unread via teamLastReadAt,
    // not Notification rows, so we don't clobber their real badge count.
    expect(payload.badge).toBeUndefined();
  });

  it("does not push when no admin has opted in", async () => {
    userFindMany.mockResolvedValue([]);

    await broadcastNewMessageToAdmins(args());

    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(pushToUsers).not.toHaveBeenCalled();
  });

  it("falls back to email when the volunteer has no name", async () => {
    userFindMany.mockResolvedValue([{ id: "admin-1" }]);

    await broadcastNewMessageToAdmins(
      args({
        volunteer: {
          id: "vol-1",
          firstName: null,
          lastName: null,
          name: null,
          email: "fallback@example.com",
        },
      })
    );

    expect(broadcast.mock.calls[0][0].data.notification.volunteer.name).toBe(
      "fallback@example.com"
    );
    expect(pushToUsers.mock.calls[0][1].title).toBe(
      "fallback@example.com messaged the team"
    );
  });

  it("truncates a long message body in the push preview", async () => {
    userFindMany.mockResolvedValue([{ id: "admin-1" }]);
    const longBody = "x".repeat(200);

    await broadcastNewMessageToAdmins(
      args({
        message: {
          id: "msg-1",
          body: longBody,
          senderId: "vol-1",
          senderRole: "VOLUNTEER" as const,
          createdAt: new Date(),
        },
      })
    );

    const body = pushToUsers.mock.calls[0][1].body as string;
    expect(body.length).toBe(140);
    expect(body.endsWith("…")).toBe(true);
  });
});

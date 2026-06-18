import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock prisma with just the methods notifyManagersOfPendingSignup and its
// downstream createNotificationsForUsers touch.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    signup: { findUnique: vi.fn() },
    restaurantManager: { findMany: vi.fn() },
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
  },
}));

// SSE fan-out is irrelevant here — keep it inert. Returning false from
// isUserConnected short-circuits the per-user SSE writes.
vi.mock("./notification-helpers", () => ({
  isUserConnected: vi.fn().mockReturnValue(false),
  sendNotificationToUser: vi.fn().mockResolvedValue(undefined),
  updateUnreadCount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./services/expo-push", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
  sendPushToUsers: vi.fn().mockResolvedValue(undefined),
}));

import { notifyManagersOfPendingSignup } from "./notifications";
import { prisma } from "./prisma";
import { sendPushToUsers } from "./services/expo-push";

type Mock = ReturnType<typeof vi.fn>;
const signupFind = prisma.signup.findUnique as unknown as Mock;
const managerFind = prisma.restaurantManager.findMany as unknown as Mock;
const notificationCreateMany = prisma.notification.createMany as unknown as Mock;
const pushToUsers = sendPushToUsers as unknown as Mock;

function pendingSignup(overrides: Record<string, unknown> = {}) {
  return {
    status: "PENDING",
    user: {
      firstName: "Sam",
      lastName: "Lee",
      name: null,
      email: "sam@example.com",
    },
    shift: {
      id: "shift-1",
      location: "Wellington",
      start: new Date("2026-07-01T02:00:00.000Z"),
      shiftType: { name: "Dinner Service" },
    },
    ...overrides,
  };
}

describe("notifyManagersOfPendingSignup", () => {
  beforeEach(() => {
    signupFind.mockReset();
    managerFind.mockReset();
    notificationCreateMany.mockReset().mockResolvedValue({ count: 0 });
    pushToUsers.mockReset().mockResolvedValue(undefined);
  });

  it("notifies managers for the shift's location with a bell notification + push", async () => {
    signupFind.mockResolvedValue(pendingSignup());
    managerFind.mockResolvedValue([
      { userId: "manager-1" },
      { userId: "manager-2" },
    ]);

    await notifyManagersOfPendingSignup("signup-1");

    // Only managers assigned to the shift's location, who opted in, are queried.
    expect(managerFind).toHaveBeenCalledWith({
      where: {
        locations: { has: "Wellington" },
        receiveNotifications: true,
        user: { role: "ADMIN" },
      },
      select: { userId: true },
    });

    // One bell notification per manager, of the new approval-request type.
    expect(notificationCreateMany).toHaveBeenCalledTimes(1);
    const data = notificationCreateMany.mock.calls[0][0].data as Array<{
      userId: string;
      type: string;
      actionUrl: string;
    }>;
    expect(data.map((d) => d.userId)).toEqual(["manager-1", "manager-2"]);
    expect(data.every((d) => d.type === "SHIFT_SIGNUP_REQUEST")).toBe(true);
    expect(data.every((d) => d.actionUrl === "/admin/shifts/shift-1")).toBe(true);

    // And a push to the same managers.
    expect(pushToUsers).toHaveBeenCalledTimes(1);
    expect(pushToUsers.mock.calls[0][0]).toEqual(["manager-1", "manager-2"]);
  });

  it("also fires for REGULAR_PENDING signups", async () => {
    signupFind.mockResolvedValue(pendingSignup({ status: "REGULAR_PENDING" }));
    managerFind.mockResolvedValue([{ userId: "manager-1" }]);

    await notifyManagersOfPendingSignup("signup-1");

    expect(notificationCreateMany).toHaveBeenCalledTimes(1);
  });

  it("no-ops when the signup was auto-approved (not pending)", async () => {
    signupFind.mockResolvedValue(pendingSignup({ status: "CONFIRMED" }));

    await notifyManagersOfPendingSignup("signup-1");

    expect(managerFind).not.toHaveBeenCalled();
    expect(notificationCreateMany).not.toHaveBeenCalled();
    expect(pushToUsers).not.toHaveBeenCalled();
  });

  it("no-ops when the shift has no location", async () => {
    signupFind.mockResolvedValue(pendingSignup({
      shift: {
        id: "shift-1",
        location: null,
        start: new Date(),
        shiftType: { name: "Dinner Service" },
      },
    }));

    await notifyManagersOfPendingSignup("signup-1");

    expect(managerFind).not.toHaveBeenCalled();
    expect(pushToUsers).not.toHaveBeenCalled();
  });

  it("no-ops when no manager is assigned to the location", async () => {
    signupFind.mockResolvedValue(pendingSignup());
    managerFind.mockResolvedValue([]);

    await notifyManagersOfPendingSignup("signup-1");

    expect(notificationCreateMany).not.toHaveBeenCalled();
    expect(pushToUsers).not.toHaveBeenCalled();
  });

  it("no-ops when the signup no longer exists", async () => {
    signupFind.mockResolvedValue(null);

    await notifyManagersOfPendingSignup("signup-1");

    expect(managerFind).not.toHaveBeenCalled();
    expect(notificationCreateMany).not.toHaveBeenCalled();
  });
});

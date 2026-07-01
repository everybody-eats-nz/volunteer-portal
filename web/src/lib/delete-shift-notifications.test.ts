import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock prisma with only what deleteNotificationsForDeletedShifts touches.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

// Notification fan-out helpers are unused here but imported by the module.
vi.mock("./notification-helpers", () => ({
  isUserConnected: vi.fn().mockReturnValue(false),
  sendNotificationToUser: vi.fn().mockResolvedValue(undefined),
  updateUnreadCount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./services/expo-push", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
  sendPushToUsers: vi.fn().mockResolvedValue(undefined),
}));

import { deleteNotificationsForDeletedShifts } from "./notifications";
import { prisma } from "./prisma";

type Mock = ReturnType<typeof vi.fn>;
const deleteMany = prisma.notification.deleteMany as unknown as Mock;

describe("deleteNotificationsForDeletedShifts", () => {
  beforeEach(() => {
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 0 });
  });

  it("deletes notifications whose actionUrl deep-links to the deleted shift", async () => {
    deleteMany.mockResolvedValue({ count: 3 });

    const result = await deleteNotificationsForDeletedShifts(["shift-1"]);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        actionUrl: { in: ["/shifts/shift-1", "/admin/shifts/shift-1"] },
      },
    });
    expect(result).toEqual({ count: 3 });
  });

  it("covers both volunteer and admin deep-link shapes for multiple shifts", async () => {
    await deleteNotificationsForDeletedShifts(["a", "b"]);

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        actionUrl: {
          in: [
            "/shifts/a",
            "/admin/shifts/a",
            "/shifts/b",
            "/admin/shifts/b",
          ],
        },
      },
    });
  });

  it("does not match id-less shift links like /shifts/mine or /shifts/details", async () => {
    await deleteNotificationsForDeletedShifts(["shift-1"]);

    const where = deleteMany.mock.calls[0][0].where as {
      actionUrl: { in: string[] };
    };
    expect(where.actionUrl.in).not.toContain("/shifts/mine");
    expect(where.actionUrl.in.some((u) => u.startsWith("/shifts/details"))).toBe(
      false
    );
  });

  it("no-ops without hitting the database when no shift ids are given", async () => {
    const result = await deleteNotificationsForDeletedShifts([]);

    expect(deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual({ count: 0 });
  });

  it("runs against the provided transaction client instead of the base prisma", async () => {
    const tx = {
      notification: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await deleteNotificationsForDeletedShifts(["shift-9"], tx as any);

    expect(tx.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        actionUrl: { in: ["/shifts/shift-9", "/admin/shifts/shift-9"] },
      },
    });
    expect(deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual({ count: 1 });
  });
});

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/email-service", () => ({ getEmailService: vi.fn() }));
vi.mock("@/lib/notifications", () => ({
  createNotificationsForUsers: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    announcement: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/announcement-targeting", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/announcement-targeting")>()),
  countAnnouncementRecipients: vi.fn().mockResolvedValue(3),
  findAnnouncementRecipients: vi.fn().mockResolvedValue([]),
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  announcement: { create: ReturnType<typeof vi.fn> };
};

function post(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Kia ora", body: "Hello", ...body }),
    })
  );
}

describe("POST /api/admin/announcements category", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({
      user: { role: "ADMIN", email: "admin@example.com" },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: "admin-1" });
    mockPrisma.announcement.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "ann-1",
        ...data,
        createdAt: new Date("2026-10-06T00:00:00Z"),
        emailSentAt: null,
        notificationSentAt: null,
        author: { id: "admin-1", name: null, firstName: "Admin", email: "a" },
      })
    );
  });

  it("refuses to create an announcement without a category", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Category is required");
    expect(mockPrisma.announcement.create).not.toHaveBeenCalled();
  });

  it("refuses an unknown category", async () => {
    const res = await post({ category: "NEWSLETTER" });
    expect(res.status).toBe(400);
    expect(mockPrisma.announcement.create).not.toHaveBeenCalled();
  });

  it("refuses a shift-related announcement with no targeted shifts", async () => {
    const res = await post({ category: "SHIFT_RELATED" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least one shift/);
    expect(mockPrisma.announcement.create).not.toHaveBeenCalled();
  });

  it("stores the category", async () => {
    const res = await post({ category: "PROMOTIONAL" });
    expect(res.status).toBe(200);
    expect(mockPrisma.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: "PROMOTIONAL" }),
      })
    );
    expect((await res.json()).announcement.category).toBe("PROMOTIONAL");
  });

  it("stores a shift-related announcement that targets shifts", async () => {
    const res = await post({
      category: "SHIFT_RELATED",
      targetShiftIds: ["shift-1"],
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "SHIFT_RELATED",
          targetShiftIds: ["shift-1"],
        }),
      })
    );
  });
});

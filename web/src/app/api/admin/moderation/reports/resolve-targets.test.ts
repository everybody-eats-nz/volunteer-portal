import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    feedComment: { findMany: vi.fn() },
    announcement: { findMany: vi.fn() },
    userAchievement: { findMany: vi.fn() },
    signup: { findMany: vi.fn() },
    dailyMenu: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { resolveReportTargets } from "./resolve-targets";

type Mocked = Record<string, { findMany: ReturnType<typeof vi.fn> }>;
const mockPrisma = prisma as unknown as Mocked;

const alice = {
  id: "u-alice",
  firstName: "Alice",
  lastName: "Ngata",
  name: null,
  email: "alice@example.com",
};

describe("resolveReportTargets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of Object.values(mockPrisma)) {
      model.findMany.mockResolvedValue([]);
    }
  });

  it("returns the comment text and its author, linked back to moderation", async () => {
    mockPrisma.feedComment.findMany.mockResolvedValue([
      { id: "c1", text: "  rude   words\nhere ", user: alice },
    ]);

    const targets = await resolveReportTargets([
      { targetType: "comment", targetId: "c1" },
    ]);

    expect(targets.get("comment:c1")).toEqual({
      kind: "Comment",
      snippet: "rude words here",
      author: {
        id: "u-alice",
        name: "Alice Ngata",
        email: "alice@example.com",
      },
      href: "/admin/volunteers/u-alice?from=%2Fadmin%2Fmoderation",
      exists: true,
    });
  });

  it("splits feed post ids by prefix and only queries what it needs", async () => {
    mockPrisma.announcement.findMany.mockResolvedValue([
      { id: "a1", title: "Kia ora", body: "Big night", author: alice },
    ]);

    const targets = await resolveReportTargets([
      { targetType: "post", targetId: "announcement-a1" },
      { targetType: "post", targetId: "journal-post-99" },
    ]);

    expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["a1"] } } })
    );
    expect(mockPrisma.feedComment.findMany).not.toHaveBeenCalled();
    expect(targets.get("post:announcement-a1")).toMatchObject({
      kind: "Announcement",
      snippet: "Kia ora: Big night",
      href: "/admin/announcements",
      exists: true,
    });
    expect(targets.get("post:journal-post-99")).toMatchObject({
      kind: "Journal post",
      snippet: null,
      exists: true,
    });
  });

  it("marks deleted targets as missing", async () => {
    const targets = await resolveReportTargets([
      { targetType: "user", targetId: "gone" },
      { targetType: "post", targetId: "achievement-gone" },
    ]);

    expect(targets.get("user:gone")).toMatchObject({
      kind: "Volunteer",
      exists: false,
      href: null,
    });
    expect(targets.get("post:achievement-gone")).toMatchObject({
      kind: "Achievement post",
      exists: false,
    });
  });

  it("trims long text to a snippet", async () => {
    mockPrisma.feedComment.findMany.mockResolvedValue([
      { id: "c2", text: "x".repeat(500), user: alice },
    ]);

    const targets = await resolveReportTargets([
      { targetType: "comment", targetId: "c2" },
    ]);
    const text = targets.get("comment:c2")?.snippet ?? "";

    expect(text).toHaveLength(280);
    expect(text.endsWith("…")).toBe(true);
  });
});

import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userAchievement: { findUnique: vi.fn() },
    signup: { findUnique: vi.fn() },
    announcement: { findUnique: vi.fn() },
  },
}));

import { resolveFeedItemOwner } from "./feed-item-owner";
import { prisma } from "@/lib/prisma";

type Mock = ReturnType<typeof vi.fn>;
const uaFind = prisma.userAchievement.findUnique as unknown as Mock;
const signupFind = prisma.signup.findUnique as unknown as Mock;
const annFind = prisma.announcement.findUnique as unknown as Mock;

beforeEach(() => {
  uaFind.mockReset();
  signupFind.mockReset();
  annFind.mockReset();
});

describe("resolveFeedItemOwner", () => {
  it("returns owner of an achievement feed item", async () => {
    uaFind.mockResolvedValue({ userId: "user-1" });
    const result = await resolveFeedItemOwner("achievement-ua-123");
    expect(result).toEqual({ ownerId: "user-1", itemLabel: "your achievement" });
    expect(uaFind).toHaveBeenCalledWith({
      where: { id: "ua-123" },
      select: { userId: true },
    });
  });

  it("returns owner of a friend-signup feed item", async () => {
    signupFind.mockResolvedValue({ userId: "user-2" });
    const result = await resolveFeedItemOwner("friend-signup-sig-456");
    expect(result).toEqual({ ownerId: "user-2", itemLabel: "your shift signup" });
    expect(signupFind).toHaveBeenCalledWith({
      where: { id: "sig-456" },
      select: { userId: true },
    });
  });

  it("returns author of an announcement feed item", async () => {
    annFind.mockResolvedValue({ createdBy: "admin-7" });
    const result = await resolveFeedItemOwner("announcement-ann-789");
    expect(result).toEqual({ ownerId: "admin-7", itemLabel: "your announcement" });
    expect(annFind).toHaveBeenCalledWith({
      where: { id: "ann-789" },
      select: { createdBy: true },
    });
  });

  it("returns null when the underlying record is missing", async () => {
    uaFind.mockResolvedValue(null);
    expect(await resolveFeedItemOwner("achievement-missing")).toBeNull();

    signupFind.mockResolvedValue(null);
    expect(await resolveFeedItemOwner("friend-signup-missing")).toBeNull();

    annFind.mockResolvedValue(null);
    expect(await resolveFeedItemOwner("announcement-missing")).toBeNull();
  });

  it("returns null for system-generated feed items with no owner", async () => {
    expect(await resolveFeedItemOwner("new-shift-Auckland-2026-05-20")).toBeNull();
    expect(await resolveFeedItemOwner("shift-recap-Wellington-2026-05-18")).toBeNull();
    expect(await resolveFeedItemOwner("daily-menu-menu-1")).toBeNull();
    expect(uaFind).not.toHaveBeenCalled();
    expect(signupFind).not.toHaveBeenCalled();
    expect(annFind).not.toHaveBeenCalled();
  });

  it("returns null for unrecognised prefixes", async () => {
    expect(await resolveFeedItemOwner("random-thing-123")).toBeNull();
    expect(await resolveFeedItemOwner("")).toBeNull();
  });
});

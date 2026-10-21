import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { contentReport: { findMany: vi.fn() } },
}));
vi.mock("./resolve-targets", () => ({
  resolveReportTargets: vi.fn(async () => new Map()),
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockFindMany = (
  prisma as unknown as {
    contentReport: { findMany: ReturnType<typeof vi.fn> };
  }
).contentReport.findMany;

const report = (id: string, status: string, day: number) => ({
  id,
  status,
  targetType: "comment",
  targetId: `c-${id}`,
  createdAt: new Date(`2026-10-${String(day).padStart(2, "0")}T00:00:00Z`),
});

describe("GET /api/admin/moderation/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ user: { role: "ADMIN" } });
  });

  it("rejects non-admins", async () => {
    mockSession.mockResolvedValue({ user: { role: "VOLUNTEER" } });
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("returns every open report plus capped resolved history, newest first", async () => {
    mockFindMany
      .mockResolvedValueOnce([report("open-old", "PENDING", 1)])
      .mockResolvedValueOnce([
        report("resolved-new", "RESOLVED", 20),
        report("resolved-mid", "RESOLVED", 10),
      ]);

    const res = await GET();
    const body = await res.json();

    expect(mockFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { status: { not: "RESOLVED" } } })
    );
    expect(mockFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { status: "RESOLVED" },
        take: body.resolvedHistoryLimit,
      })
    );
    expect(body.reports.map((r: { id: string }) => r.id)).toEqual([
      "resolved-new",
      "resolved-mid",
      "open-old",
    ]);
  });
});

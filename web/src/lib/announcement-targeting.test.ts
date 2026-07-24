import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ count: BigInt(0) }]),
  },
}));

import type { Prisma } from "@/generated/client";
import {
  AnnouncementTargeting,
  countAnnouncementRecipients,
  findAnnouncementRecipients,
} from "./announcement-targeting";
import { prisma } from "@/lib/prisma";

type Mock = ReturnType<typeof vi.fn>;
const queryRaw = prisma.$queryRaw as unknown as Mock;

const emptyTargeting: AnnouncementTargeting = {
  targetLocations: [],
  targetGrades: [],
  targetLabelIds: [],
  targetUserIds: [],
  targetShiftIds: [],
};

/** The SQL text (placeholders, not values) of the last $queryRaw call. */
function lastSql(): string {
  const arg = queryRaw.mock.calls.at(-1)?.[0] as Prisma.Sql;
  return arg.sql;
}

/** The bound parameter values of the last $queryRaw call. */
function lastValues(): unknown[] {
  const arg = queryRaw.mock.calls.at(-1)?.[0] as Prisma.Sql;
  return arg.values;
}

beforeEach(() => {
  queryRaw.mockClear();
  queryRaw.mockResolvedValue([{ count: BigInt(0) }]);
});

describe("announcement recipient targeting", () => {
  it("excludes archived volunteers when targeting everyone", async () => {
    queryRaw.mockResolvedValueOnce([{ count: BigInt(42) }]);
    const count = await countAnnouncementRecipients(emptyTargeting);
    expect(count).toBe(42);
    expect(lastSql()).toContain(`"archivedAt" IS NULL`);
  });

  it("excludes archived volunteers from every broad dimension", async () => {
    await findAnnouncementRecipients({
      ...emptyTargeting,
      targetLocations: ["Wellington"],
      targetGrades: ["GREEN"],
      targetLabelIds: ["label-1"],
      targetShiftIds: ["shift-1"],
    });
    expect(lastSql()).toContain(`"archivedAt" IS NULL`);
    // No explicit user IDs, so no escape hatch on the archive filter.
    expect(lastSql()).not.toContain(`OR "User".id = ANY(`);
  });

  it("still reaches archived volunteers named explicitly by id", async () => {
    await findAnnouncementRecipients({
      ...emptyTargeting,
      targetUserIds: ["user-1", "user-2"],
    });
    const sql = lastSql().replace(/\s+/g, " ");
    expect(sql).toContain(`( "archivedAt" IS NULL OR "User".id = ANY(`);
    // The exemption reuses the same ids as the targeting condition itself.
    expect(lastValues()).toEqual(["user-1", "user-2", "user-1", "user-2"]);
  });

  it("keeps cross-dimension AND semantics when ids are combined with a filter", async () => {
    await findAnnouncementRecipients({
      ...emptyTargeting,
      targetUserIds: ["user-1"],
      targetGrades: ["GREEN"],
    });
    const sql = lastSql().replace(/\s+/g, " ");
    // The archive exemption widens who the id list may reach — it never
    // relaxes the other dimensions, so a named volunteer of the wrong grade
    // is still filtered out.
    expect(sql).toContain(`( "archivedAt" IS NULL OR "User".id = ANY(`);
    expect(sql).toContain(`"volunteerGrade"::text = ANY(`);
  });
});

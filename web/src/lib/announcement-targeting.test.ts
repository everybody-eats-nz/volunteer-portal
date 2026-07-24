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
  hasActivityTargeting,
  parseTargetingFromRequest,
  userMatchesActivityTargeting,
  type ActivityTargeting,
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
  targetActivityLocations: [],
  targetActivityFrom: null,
  targetActivityTo: null,
  targetActivityMinShifts: null,
  targetActivityMaxShifts: null,
};

/** Shorthand for building activity targeting in the tests below. */
function activity(overrides: Partial<ActivityTargeting> = {}): ActivityTargeting {
  return {
    targetActivityLocations: [],
    targetActivityFrom: null,
    targetActivityTo: null,
    targetActivityMinShifts: 1,
    targetActivityMaxShifts: null,
    ...overrides,
  };
}

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

describe("announcement-targeting", () => {
  describe("parseTargetingFromRequest", () => {
    it("leaves the activity dimension off when no minimum is given", () => {
      const t = parseTargetingFromRequest({ targetLocations: ["Onehunga"] });

      expect(t.targetActivityMinShifts).toBeNull();
      expect(hasActivityTargeting(t)).toBe(false);
    });

    it("anchors the from date to midnight of that NZ calendar day", () => {
      // 24 April is outside NZ daylight saving, so NZST = UTC+12 and local
      // midnight is 12:00 UTC the day before.
      const t = parseTargetingFromRequest({
        targetActivityFrom: "2026-04-24",
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityFrom?.toISOString()).toBe(
        "2026-04-23T12:00:00.000Z"
      );
    });

    it("anchors the to date to the end of that NZ calendar day", () => {
      // 24 January is inside daylight saving, so NZDT = UTC+13.
      const t = parseTargetingFromRequest({
        targetActivityTo: "2026-01-24",
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityTo?.toISOString()).toBe(
        "2026-01-24T10:59:59.000Z"
      );
    });

    it("drops malformed dates rather than throwing mid-send", () => {
      const t = parseTargetingFromRequest({
        targetActivityFrom: "last April",
        targetActivityTo: 1234,
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityFrom).toBeNull();
      expect(t.targetActivityTo).toBeNull();
    });

    it("rejects well-formed but impossible dates instead of rolling them over", () => {
      // The date constructor happily turns these into real dates in a later
      // month. Accepting that would silently shift a window bound.
      const t = parseTargetingFromRequest({
        targetActivityFrom: "2026-13-99",
        targetActivityTo: "2026-02-31",
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityFrom).toBeNull();
      expect(t.targetActivityTo).toBeNull();
    });

    it("keeps a real leap day", () => {
      const t = parseTargetingFromRequest({
        targetActivityFrom: "2028-02-29",
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityFrom).not.toBeNull();
    });

    it("rejects a leap day in a non-leap year", () => {
      const t = parseTargetingFromRequest({
        targetActivityFrom: "2027-02-29",
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityFrom).toBeNull();
    });

    it("rejects a zero month or day", () => {
      // The shape regex allows these; they roll backwards into the previous
      // year rather than failing, so only the round-trip check catches them.
      expect(
        parseTargetingFromRequest({
          targetActivityFrom: "2026-00-01",
          targetActivityMinShifts: 1,
        }).targetActivityFrom
      ).toBeNull();
      expect(
        parseTargetingFromRequest({
          targetActivityFrom: "2026-01-00",
          targetActivityMinShifts: 1,
        }).targetActivityFrom
      ).toBeNull();
    });

    it("clamps the minimum shift count into a sane range", () => {
      expect(
        parseTargetingFromRequest({ targetActivityMinShifts: 0 })
          .targetActivityMinShifts
      ).toBe(1);
      expect(
        parseTargetingFromRequest({ targetActivityMinShifts: -5 })
          .targetActivityMinShifts
      ).toBe(1);
      expect(
        parseTargetingFromRequest({ targetActivityMinShifts: 10_000 })
          .targetActivityMinShifts
      ).toBe(999);
      expect(
        parseTargetingFromRequest({ targetActivityMinShifts: 2.7 })
          .targetActivityMinShifts
      ).toBe(2);
    });

    it("drops the maximum when the dimension is off", () => {
      const t = parseTargetingFromRequest({ targetActivityMaxShifts: 3 });

      expect(t.targetActivityMinShifts).toBeNull();
      expect(t.targetActivityMaxShifts).toBeNull();
    });

    it("clamps the maximum shift count and never lets it cross the minimum", () => {
      expect(
        parseTargetingFromRequest({
          targetActivityMinShifts: 1,
          targetActivityMaxShifts: 10_000,
        }).targetActivityMaxShifts
      ).toBe(999);
      // A max below the min would silently match no one — raise it instead.
      expect(
        parseTargetingFromRequest({
          targetActivityMinShifts: 5,
          targetActivityMaxShifts: 2,
        }).targetActivityMaxShifts
      ).toBe(5);
      expect(
        parseTargetingFromRequest({
          targetActivityMinShifts: 1,
          targetActivityMaxShifts: "loads",
        }).targetActivityMaxShifts
      ).toBeNull();
    });

    it("ignores non-string entries in the targeting arrays", () => {
      const t = parseTargetingFromRequest({
        targetLocations: ["Onehunga", 42, null],
        targetActivityLocations: "Onehunga",
      });

      expect(t.targetLocations).toEqual(["Onehunga"]);
      expect(t.targetActivityLocations).toEqual([]);
    });
  });

  describe("userMatchesActivityTargeting", () => {
    const onehungaApril = { location: "Onehunga", end: new Date("2026-04-30") };
    const onehungaJune = { location: "Onehunga", end: new Date("2026-06-15") };
    const wellingtonJune = {
      location: "Wellington",
      end: new Date("2026-06-15"),
    };

    it("matches everyone when the dimension is off", () => {
      expect(
        userMatchesActivityTargeting(
          [],
          activity({ targetActivityMinShifts: null })
        )
      ).toBe(true);
    });

    it("requires at least one worked shift when switched on", () => {
      expect(userMatchesActivityTargeting([], activity())).toBe(false);
      expect(userMatchesActivityTargeting([onehungaJune], activity())).toBe(
        true
      );
    });

    it("counts only shifts at the targeted locations", () => {
      const target = activity({ targetActivityLocations: ["Onehunga"] });

      expect(userMatchesActivityTargeting([wellingtonJune], target)).toBe(false);
      expect(userMatchesActivityTargeting([onehungaJune], target)).toBe(true);
    });

    it("excludes shifts with no location when locations are targeted", () => {
      expect(
        userMatchesActivityTargeting(
          [{ location: null, end: new Date("2026-06-15") }],
          activity({ targetActivityLocations: ["Onehunga"] })
        )
      ).toBe(false);
    });

    it("counts shifts at any location when none are targeted", () => {
      expect(
        userMatchesActivityTargeting([wellingtonJune], activity())
      ).toBe(true);
    });

    it("applies the date window to the shift end time, inclusively", () => {
      const target = activity({
        targetActivityFrom: new Date("2026-05-01"),
        targetActivityTo: new Date("2026-07-01"),
      });

      expect(userMatchesActivityTargeting([onehungaApril], target)).toBe(false);
      expect(userMatchesActivityTargeting([onehungaJune], target)).toBe(true);
      expect(
        userMatchesActivityTargeting(
          [{ location: "Onehunga", end: new Date("2026-05-01") }],
          target
        )
      ).toBe(true);
    });

    it("requires the full minimum across matching shifts only", () => {
      const target = activity({
        targetActivityLocations: ["Onehunga"],
        targetActivityMinShifts: 2,
      });

      expect(
        userMatchesActivityTargeting([onehungaJune, wellingtonJune], target)
      ).toBe(false);
      expect(
        userMatchesActivityTargeting([onehungaJune, onehungaApril], target)
      ).toBe(true);
    });

    it("excludes volunteers over the maximum", () => {
      const firstShiftOnly = activity({
        targetActivityMinShifts: 1,
        targetActivityMaxShifts: 1,
      });

      expect(userMatchesActivityTargeting([], firstShiftOnly)).toBe(false);
      expect(
        userMatchesActivityTargeting([onehungaJune], firstShiftOnly)
      ).toBe(true);
      expect(
        userMatchesActivityTargeting(
          [onehungaJune, onehungaApril],
          firstShiftOnly
        )
      ).toBe(false);
    });

    it("counts only matching shifts against the maximum", () => {
      // Two shifts overall, but only one at the targeted location — still
      // inside a max of 1.
      expect(
        userMatchesActivityTargeting(
          [onehungaJune, wellingtonJune],
          activity({
            targetActivityLocations: ["Onehunga"],
            targetActivityMaxShifts: 1,
          })
        )
      ).toBe(true);
    });
  });

  describe("archived volunteers", () => {
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
        targetActivityLocations: ["Wellington"],
        targetActivityMinShifts: 2,
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

  describe("shift-history shift-count SQL", () => {
    it("uses EXISTS for the common at-least-one-shift case", async () => {
      await findAnnouncementRecipients({
        ...emptyTargeting,
        targetActivityMinShifts: 1,
      });
      expect(lastSql()).toContain("EXISTS (");
      expect(lastSql()).not.toContain("COUNT(DISTINCT");
    });

    it("counts when the minimum is above one", async () => {
      await findAnnouncementRecipients({
        ...emptyTargeting,
        targetActivityMinShifts: 3,
      });
      const sql = lastSql().replace(/\s+/g, " ");
      expect(sql).toContain("COUNT(DISTINCT");
      expect(lastValues()).toContain(3);
    });

    it("counts rather than short-circuiting once a maximum is set", async () => {
      // EXISTS would be wrong here: "worked exactly 1 shift" has to reject a
      // volunteer with two, and EXISTS stops at the first match.
      await findAnnouncementRecipients({
        ...emptyTargeting,
        targetActivityMinShifts: 1,
        targetActivityMaxShifts: 1,
      });
      const sql = lastSql().replace(/\s+/g, " ");
      expect(sql).not.toContain("EXISTS ( SELECT 1 FROM \"Signup\" JOIN \"Shift\"");
      expect(sql).toContain("COUNT(DISTINCT");
      expect(sql).toContain("BETWEEN");
      expect(lastValues()).toEqual(expect.arrayContaining([1, 1]));
    });

    it("bounds the count from both ends for a range", async () => {
      await findAnnouncementRecipients({
        ...emptyTargeting,
        targetActivityMinShifts: 2,
        targetActivityMaxShifts: 5,
      });
      expect(lastSql().replace(/\s+/g, " ")).toContain("BETWEEN");
      expect(lastValues()).toEqual(expect.arrayContaining([2, 5]));
    });
  });
});

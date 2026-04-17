import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { subMonths } from "date-fns";
import {
  ARCHIVE_THRESHOLDS,
  effectiveLastActivity,
  whereNeverMigrated,
  whereNeverActivatedNudge,
  whereNeverActivatedArchive,
  getInactiveWarningCandidates,
  getInactiveArchiveCandidates,
  consumeExtensionToken,
} from "./archive-service";
import { prisma } from "./prisma";

type RawUserRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  createdAt: Date;
  isMigrated: boolean;
  profileCompleted: boolean;
  archiveExtendedUntil: Date | null;
  archiveWarningSentAt: Date | null;
  lastConfirmedShiftAt: Date | null;
};

const baseUser: Omit<RawUserRow, "id"> = {
  email: "v@example.com",
  firstName: "V",
  lastName: null,
  name: "V",
  createdAt: new Date("2024-01-01"),
  isMigrated: false,
  profileCompleted: true,
  archiveExtendedUntil: null,
  archiveWarningSentAt: null,
  lastConfirmedShiftAt: null,
};

function row(id: string, overrides: Partial<RawUserRow>): RawUserRow {
  return { ...baseUser, id, ...overrides };
}

describe("archive-service", () => {
  describe("effectiveLastActivity", () => {
    it("returns null when both are null", () => {
      expect(effectiveLastActivity(null, null)).toBeNull();
    });

    it("returns lastConfirmedShiftAt when extension is null", () => {
      const d = new Date("2025-06-01");
      expect(effectiveLastActivity(d, null)).toBe(d);
    });

    it("returns archiveExtendedUntil when shift is null", () => {
      const d = new Date("2025-06-01");
      expect(effectiveLastActivity(null, d)).toBe(d);
    });

    it("returns the later of the two", () => {
      const older = new Date("2025-01-01");
      const newer = new Date("2025-06-01");
      expect(effectiveLastActivity(older, newer)).toBe(newer);
      expect(effectiveLastActivity(newer, older)).toBe(newer);
    });
  });

  describe("where-clause helpers", () => {
    const now = new Date("2026-01-01T00:00:00Z");

    it("whereNeverMigrated filters migrated+incomplete volunteers", () => {
      const w = whereNeverMigrated();
      expect(w).toMatchObject({
        role: "VOLUNTEER",
        archivedAt: null,
        isMigrated: true,
        profileCompleted: false,
      });
    });

    it("whereNeverActivatedNudge uses the 1-month cutoff and requires no nudge+no confirmed shifts", () => {
      const w = whereNeverActivatedNudge(now);
      const expectedCutoff = subMonths(
        now,
        ARCHIVE_THRESHOLDS.NEVER_ACTIVATED_NUDGE_MONTHS
      );
      expect(w).toMatchObject({
        role: "VOLUNTEER",
        archivedAt: null,
        isMigrated: false,
        firstShiftNudgeSentAt: null,
        signups: { none: { status: "CONFIRMED" } },
      });
      expect((w.createdAt as { lte: Date }).lte).toEqual(expectedCutoff);
    });

    it("whereNeverActivatedArchive uses the 3-month cutoff", () => {
      const w = whereNeverActivatedArchive(now);
      const expectedCutoff = subMonths(
        now,
        ARCHIVE_THRESHOLDS.NEVER_ACTIVATED_ARCHIVE_MONTHS
      );
      expect((w.createdAt as { lte: Date }).lte).toEqual(expectedCutoff);
      expect(w).toMatchObject({
        role: "VOLUNTEER",
        archivedAt: null,
        isMigrated: false,
        signups: { none: { status: "CONFIRMED" } },
      });
    });
  });

  describe("getInactiveWarningCandidates", () => {
    const now = new Date("2026-04-17T00:00:00Z");
    const warningCutoff = subMonths(
      now,
      ARCHIVE_THRESHOLDS.INACTIVE_WARNING_MONTHS
    );

    beforeEach(() => {
      // Reset the raw-query mock before each test
      // Replace the raw-query method with a fresh mock. Cast through unknown
      // because the Prisma client type has a complex overloaded signature.
      (prisma as unknown as { $queryRaw: unknown }).$queryRaw = vi.fn();
    });

    it("returns users whose last activity is older than the 11mo cutoff and not yet warned", async () => {
      const oldActivity = subMonths(now, 12);
      const recentActivity = subMonths(now, 3);

      // @ts-expect-error - test mock
      prisma.$queryRaw.mockResolvedValueOnce([
        row("old", { lastConfirmedShiftAt: oldActivity }),
        row("recent", { lastConfirmedShiftAt: recentActivity }),
      ]);

      const result = await getInactiveWarningCandidates(now);
      expect(result.map((u) => u.id)).toEqual(["old"]);
      expect(result[0].effectiveLastActivityAt).toEqual(oldActivity);
    });

    it("skips users who already got a warning after their last activity", async () => {
      const oldActivity = subMonths(now, 12);
      const warnedAfter = subMonths(now, 11);

      // @ts-expect-error - test mock
      prisma.$queryRaw.mockResolvedValueOnce([
        row("warned", {
          lastConfirmedShiftAt: oldActivity,
          archiveWarningSentAt: warnedAfter,
        }),
      ]);

      expect(await getInactiveWarningCandidates(now)).toEqual([]);
    });

    it("re-warns if the warning predates a newer activity", async () => {
      const newShift = subMonths(now, 12); // still past the warning cutoff
      const oldWarning = subMonths(now, 14); // before the shift

      // @ts-expect-error - test mock
      prisma.$queryRaw.mockResolvedValueOnce([
        row("re-warn", {
          lastConfirmedShiftAt: newShift,
          archiveWarningSentAt: oldWarning,
        }),
      ]);

      const result = await getInactiveWarningCandidates(now);
      expect(result.map((u) => u.id)).toEqual(["re-warn"]);
    });

    it("uses archiveExtendedUntil as a synthetic last activity when newer than the shift", async () => {
      const oldShift = subMonths(now, 13);
      const extendedRecent = subMonths(now, 2);

      // @ts-expect-error - test mock
      prisma.$queryRaw.mockResolvedValueOnce([
        row("extended", {
          lastConfirmedShiftAt: oldShift,
          archiveExtendedUntil: extendedRecent,
        }),
      ]);

      expect(await getInactiveWarningCandidates(now)).toEqual([]);
    });

    it("skips users who have never had a confirmed shift (handled by never-activated rule)", async () => {
      // @ts-expect-error - test mock
      prisma.$queryRaw.mockResolvedValueOnce([
        row("unactivated", { lastConfirmedShiftAt: null }),
      ]);

      expect(await getInactiveWarningCandidates(now)).toEqual([]);
    });

    it("skips migrated users who never completed setup (they go through never-migrated)", async () => {
      // @ts-expect-error - test mock
      prisma.$queryRaw.mockResolvedValueOnce([
        row("unmigrated", {
          isMigrated: true,
          profileCompleted: false,
          lastConfirmedShiftAt: subMonths(now, 13),
        }),
      ]);

      expect(await getInactiveWarningCandidates(now)).toEqual([]);
    });

    it("uses warningCutoff = now - 11 months", () => {
      expect(warningCutoff).toEqual(subMonths(now, 11));
    });
  });

  describe("getInactiveArchiveCandidates", () => {
    const now = new Date("2026-04-17T00:00:00Z");

    beforeEach(() => {
      // Replace the raw-query method with a fresh mock. Cast through unknown
      // because the Prisma client type has a complex overloaded signature.
      (prisma as unknown as { $queryRaw: unknown }).$queryRaw = vi.fn();
    });

    it("requires the warning to be at least WARNING_TO_ARCHIVE_MIN_DAYS old", async () => {
      const oldActivity = subMonths(now, 13);
      const recentWarning = new Date(
        now.getTime() -
          (ARCHIVE_THRESHOLDS.WARNING_TO_ARCHIVE_MIN_DAYS - 1) *
            24 *
            60 *
            60 *
            1000
      );

      // @ts-expect-error - test mock
      prisma.$queryRaw.mockResolvedValueOnce([
        row("recent-warn", {
          lastConfirmedShiftAt: oldActivity,
          archiveWarningSentAt: recentWarning,
        }),
      ]);

      // The warning is too recent (<30 days) — don't archive yet
      expect(await getInactiveArchiveCandidates(now)).toEqual([]);
    });

    it("archives users whose activity is past the 12mo cutoff AND warning is old enough", async () => {
      const oldActivity = subMonths(now, 13);
      const oldEnoughWarning = new Date(
        now.getTime() -
          (ARCHIVE_THRESHOLDS.WARNING_TO_ARCHIVE_MIN_DAYS + 1) *
            24 *
            60 *
            60 *
            1000
      );

      // @ts-expect-error - test mock
      prisma.$queryRaw.mockResolvedValueOnce([
        row("archive-me", {
          lastConfirmedShiftAt: oldActivity,
          archiveWarningSentAt: oldEnoughWarning,
        }),
      ]);

      const result = await getInactiveArchiveCandidates(now);
      expect(result.map((u) => u.id)).toEqual(["archive-me"]);
    });

    it("does not archive users who were never warned", async () => {
      const oldActivity = subMonths(now, 13);

      // @ts-expect-error - test mock
      prisma.$queryRaw.mockResolvedValueOnce([
        row("no-warning", {
          lastConfirmedShiftAt: oldActivity,
          archiveWarningSentAt: null,
        }),
      ]);

      expect(await getInactiveArchiveCandidates(now)).toEqual([]);
    });
  });

  describe("consumeExtensionToken", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-17T00:00:00Z"));
      // @ts-expect-error - test mocks the Prisma singleton
      prisma.user = {
        findUnique: vi.fn(),
      };
      prisma.$transaction = vi.fn().mockResolvedValue(undefined) as unknown as typeof prisma.$transaction;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns null for unknown tokens", async () => {
      // @ts-expect-error - test mock
      prisma.user.findUnique.mockResolvedValueOnce(null);
      expect(await consumeExtensionToken("nope")).toBeNull();
    });

    it("returns null for expired tokens", async () => {
      // @ts-expect-error - test mock
      prisma.user.findUnique.mockResolvedValueOnce({
        id: "u1",
        archiveExtensionTokenExpiresAt: new Date("2026-04-01T00:00:00Z"),
        archivedAt: null,
      });
      expect(await consumeExtensionToken("expired")).toBeNull();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns null when the account is already archived", async () => {
      // @ts-expect-error - test mock
      prisma.user.findUnique.mockResolvedValueOnce({
        id: "u1",
        archiveExtensionTokenExpiresAt: new Date("2026-06-01T00:00:00Z"),
        archivedAt: new Date(),
      });
      expect(await consumeExtensionToken("archived-user")).toBeNull();
    });

    it("returns the userId and runs the update transaction for a valid token", async () => {
      // @ts-expect-error - test mock
      prisma.user.findUnique.mockResolvedValueOnce({
        id: "u1",
        archiveExtensionTokenExpiresAt: new Date("2026-06-01T00:00:00Z"),
        archivedAt: null,
      });
      expect(await consumeExtensionToken("valid")).toBe("u1");
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});

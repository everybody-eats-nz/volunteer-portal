import crypto from "crypto";
import { subMonths } from "date-fns";
import { prisma } from "./prisma";
import {
  ArchiveReason,
  ArchiveEventType,
  ArchiveTriggerSource,
  Prisma,
} from "@/generated/client";
import { getEmailService } from "./email-service";
import { getBaseUrl } from "./utils";

export const ARCHIVE_THRESHOLDS = {
  INACTIVE_WARNING_MONTHS: 11,
  INACTIVE_ARCHIVE_MONTHS: 12,
  NEVER_ACTIVATED_NUDGE_MONTHS: 1,
  NEVER_ACTIVATED_ARCHIVE_MONTHS: 3,
  WARNING_TO_ARCHIVE_MIN_DAYS: 30,
  EXTENSION_TOKEN_EXPIRY_DAYS: 60,
} as const;

export type ArchiveCategory =
  | "never-migrated"
  | "never-activated-nudge"
  | "never-activated-archive"
  | "inactive-warning"
  | "inactive-archive";

export const ARCHIVE_CATEGORY_LABELS: Record<ArchiveCategory, string> = {
  "never-migrated": "Never migrated",
  "never-activated-nudge": "Never activated — needs nudge",
  "never-activated-archive": "Never activated — to archive",
  "inactive-warning": "Inactive — needs warning",
  "inactive-archive": "Inactive — to archive",
};

// A user is "effectively active" if their MAX(last CONFIRMED shift start,
// archiveExtendedUntil) is within the window. `archiveExtendedUntil` is used as a
// synthetic last-activity timestamp — set when a user clicks the "keep me active"
// link or reactivates their account.

/**
 * Base `where` clause shared by all active-user queries.
 * Excludes admins, archived users, and unverified/incomplete accounts where
 * appropriate is done per-rule.
 */
function activeVolunteerWhere(): Prisma.UserWhereInput {
  return {
    role: "VOLUNTEER",
    archivedAt: null,
  };
}

// Volunteers who are manually assigned to shifts (admin-created CONFIRMED
// signups) or set up as a regular have real activity that the platform doesn't
// see otherwise — they may never log in or finish their profile. Archive rules
// must treat both as "active" so we don't sweep them up.
const noConfirmedSignups: Prisma.UserWhereInput = {
  signups: { none: { status: "CONFIRMED" } },
};
const noActiveRegular: Prisma.UserWhereInput = {
  regularVolunteers: {
    none: { isActive: true, isPausedByUser: false },
  },
};

/**
 * Users who migrated from the legacy system but never completed setup.
 * Protected if they have manual CONFIRMED signups or an active regular slot.
 */
export function whereNeverMigrated(): Prisma.UserWhereInput {
  return {
    ...activeVolunteerWhere(),
    isMigrated: true,
    profileCompleted: false,
    ...noConfirmedSignups,
    ...noActiveRegular,
  };
}

/**
 * Users who registered themselves (not migrated) but never completed a shift,
 * and registered more than N months ago, and haven't received the nudge yet.
 */
export function whereNeverActivatedNudge(now: Date): Prisma.UserWhereInput {
  const cutoff = subMonths(now, ARCHIVE_THRESHOLDS.NEVER_ACTIVATED_NUDGE_MONTHS);
  return {
    ...activeVolunteerWhere(),
    isMigrated: false,
    createdAt: { lte: cutoff },
    firstShiftNudgeSentAt: null,
    ...noConfirmedSignups,
    ...noActiveRegular,
  };
}

/**
 * Users who registered themselves more than 3 months ago and never confirmed
 * a shift — archive.
 */
export function whereNeverActivatedArchive(now: Date): Prisma.UserWhereInput {
  const cutoff = subMonths(now, ARCHIVE_THRESHOLDS.NEVER_ACTIVATED_ARCHIVE_MONTHS);
  return {
    ...activeVolunteerWhere(),
    isMigrated: false,
    createdAt: { lte: cutoff },
    ...noConfirmedSignups,
    ...noActiveRegular,
  };
}

/**
 * Get users with a "lastConfirmedShiftAt" computed per user — uses raw SQL
 * because Prisma's groupBy can't aggregate across relations.
 */
async function getUsersWithLastShift(now: Date): Promise<
  Array<{
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
  }>
> {
  // Returns all non-archived volunteers with their most recent CONFIRMED
  // signup's shift.start (null if none). Excludes users with an active regular
  // slot — they're considered active even if their last CONFIRMED shift is
  // stale, since admins manage their roster outside the platform.
  return prisma.$queryRaw`
    SELECT
      u.id,
      u.email,
      u."firstName",
      u."lastName",
      u.name,
      u."createdAt",
      u."isMigrated",
      u."profileCompleted",
      u."archiveExtendedUntil",
      u."archiveWarningSentAt",
      (
        SELECT MAX(sh."start")
        FROM "Signup" s
        JOIN "Shift" sh ON sh.id = s."shiftId"
        WHERE s."userId" = u.id AND s.status = 'CONFIRMED'
      ) AS "lastConfirmedShiftAt"
    FROM "User" u
    WHERE u.role = 'VOLUNTEER'
      AND u."archivedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "RegularVolunteer" rv
        WHERE rv."userId" = u.id
          AND rv."isActive" = TRUE
          AND rv."isPausedByUser" = FALSE
      )
  `;
}

/**
 * Effective last activity: max of the user's most recent CONFIRMED shift
 * and `archiveExtendedUntil`.
 */
export function effectiveLastActivity(
  lastConfirmedShiftAt: Date | null,
  archiveExtendedUntil: Date | null
): Date | null {
  if (!lastConfirmedShiftAt && !archiveExtendedUntil) return null;
  if (!lastConfirmedShiftAt) return archiveExtendedUntil;
  if (!archiveExtendedUntil) return lastConfirmedShiftAt;
  return lastConfirmedShiftAt > archiveExtendedUntil
    ? lastConfirmedShiftAt
    : archiveExtendedUntil;
}

export type CandidateUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  createdAt: Date;
  effectiveLastActivityAt: Date | null;
  archiveWarningSentAt: Date | null;
};

/**
 * Candidates for the 11mo warning email.
 */
export async function getInactiveWarningCandidates(
  now: Date = new Date()
): Promise<CandidateUser[]> {
  const warningCutoff = subMonths(now, ARCHIVE_THRESHOLDS.INACTIVE_WARNING_MONTHS);
  const users = await getUsersWithLastShift(now);
  return users
    .filter((u) => !u.isMigrated || u.profileCompleted) // unmigrated handled separately
    .map((u) => ({
      ...u,
      effectiveLastActivityAt: effectiveLastActivity(
        u.lastConfirmedShiftAt,
        u.archiveExtendedUntil
      ),
    }))
    .filter((u) => {
      // Must have had at least one CONFIRMED shift (otherwise falls under never-activated rules)
      if (!u.effectiveLastActivityAt) return false;
      if (u.effectiveLastActivityAt > warningCutoff) return false;
      // Haven't already warned since their last activity
      if (
        u.archiveWarningSentAt &&
        u.archiveWarningSentAt > u.effectiveLastActivityAt
      ) {
        return false;
      }
      return true;
    });
}

/**
 * Candidates for the 12mo inactivity archive. Require the warning was sent at
 * least WARNING_TO_ARCHIVE_MIN_DAYS ago to give users a chance to respond.
 */
export async function getInactiveArchiveCandidates(
  now: Date = new Date()
): Promise<CandidateUser[]> {
  const archiveCutoff = subMonths(now, ARCHIVE_THRESHOLDS.INACTIVE_ARCHIVE_MONTHS);
  const minWarningAge = new Date(
    now.getTime() -
      ARCHIVE_THRESHOLDS.WARNING_TO_ARCHIVE_MIN_DAYS * 24 * 60 * 60 * 1000
  );
  const users = await getUsersWithLastShift(now);
  return users
    .filter((u) => !u.isMigrated || u.profileCompleted)
    .map((u) => ({
      ...u,
      effectiveLastActivityAt: effectiveLastActivity(
        u.lastConfirmedShiftAt,
        u.archiveExtendedUntil
      ),
    }))
    .filter((u) => {
      if (!u.effectiveLastActivityAt) return false;
      if (u.effectiveLastActivityAt > archiveCutoff) return false;
      // Must have been warned, and warning must be old enough
      if (!u.archiveWarningSentAt) return false;
      if (u.archiveWarningSentAt > minWarningAge) return false;
      return true;
    });
}

// --------------------------------------------------------------------------
// Actions (state-changing)
// --------------------------------------------------------------------------

export async function archiveUser(params: {
  userId: string;
  reason: ArchiveReason;
  triggerSource: ArchiveTriggerSource;
  actorId?: string | null;
  note?: string;
}): Promise<void> {
  const { userId, reason, triggerSource, actorId, note } = params;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        archivedAt: new Date(),
        archiveReason: reason,
        archivedBy: actorId ?? null,
        // Clear extension state now that the user is archived
        archiveExtensionToken: null,
        archiveExtensionTokenExpiresAt: null,
      },
    });

    await tx.archiveLog.create({
      data: {
        userId,
        eventType: ArchiveEventType.ARCHIVED,
        reason,
        triggerSource,
        actorId: actorId ?? null,
        note: note ?? null,
      },
    });
  });
}

export async function unarchiveUser(params: {
  userId: string;
  triggerSource: ArchiveTriggerSource;
  actorId?: string | null;
  note?: string;
}): Promise<void> {
  const { userId, triggerSource, actorId, note } = params;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        archivedAt: null,
        archiveReason: null,
        archivedBy: null,
        // Give them a fresh clock by bumping the synthetic last-activity date
        archiveExtendedUntil: new Date(),
        // Allow future warnings
        archiveWarningSentAt: null,
      },
    });

    await tx.archiveLog.create({
      data: {
        userId,
        eventType: ArchiveEventType.UNARCHIVED,
        triggerSource,
        actorId: actorId ?? null,
        note: note ?? null,
      },
    });
  });
}

/**
 * Send the 11-month warning email with the "keep me active" extension link.
 * Generates a single-use token, stamps archiveWarningSentAt, and logs the event.
 */
export async function sendInactiveWarning(params: {
  userId: string;
  triggerSource: ArchiveTriggerSource;
  actorId?: string | null;
}): Promise<void> {
  const { userId, triggerSource, actorId } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, name: true },
  });
  if (!user) throw new Error(`User ${userId} not found`);

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() +
      ARCHIVE_THRESHOLDS.EXTENSION_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        archiveWarningSentAt: new Date(),
        archiveExtensionToken: token,
        archiveExtensionTokenExpiresAt: expiresAt,
      },
    });
    await tx.archiveLog.create({
      data: {
        userId,
        eventType: ArchiveEventType.WARNING_SENT,
        triggerSource,
        actorId: actorId ?? null,
      },
    });
  });

  const firstName = user.firstName || user.name?.split(" ")[0] || "there";
  const extendLink = `${getBaseUrl()}/api/archive/extend?token=${token}`;

  await getEmailService().sendArchiveWarning({
    to: user.email,
    firstName,
    extendLink,
  });
}

export async function sendFirstShiftNudge(params: {
  userId: string;
  triggerSource: ArchiveTriggerSource;
  actorId?: string | null;
}): Promise<void> {
  const { userId, triggerSource, actorId } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, name: true },
  });
  if (!user) throw new Error(`User ${userId} not found`);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { firstShiftNudgeSentAt: new Date() },
    });
    await tx.archiveLog.create({
      data: {
        userId,
        eventType: ArchiveEventType.FIRST_SHIFT_NUDGE_SENT,
        triggerSource,
        actorId: actorId ?? null,
      },
    });
  });

  const firstName = user.firstName || user.name?.split(" ")[0] || "there";
  const shiftsLink = `${getBaseUrl()}/shifts`;

  await getEmailService().sendFirstShiftNudge({
    to: user.email,
    firstName,
    shiftsLink,
  });
}

/**
 * Consume an extension token. Sets archiveExtendedUntil = now (synthetic
 * last-activity), clears the token and warning state. Returns the user id on
 * success or null if the token is invalid or expired.
 */
export async function consumeExtensionToken(token: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { archiveExtensionToken: token },
    select: {
      id: true,
      archiveExtensionTokenExpiresAt: true,
      archivedAt: true,
    },
  });
  if (!user) return null;
  if (user.archivedAt) return null; // Already archived — don't reuse
  if (
    !user.archiveExtensionTokenExpiresAt ||
    user.archiveExtensionTokenExpiresAt < new Date()
  ) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        archiveExtendedUntil: new Date(),
        archiveWarningSentAt: null,
        archiveExtensionToken: null,
        archiveExtensionTokenExpiresAt: null,
      },
    });
    await tx.archiveLog.create({
      data: {
        userId: user.id,
        eventType: ArchiveEventType.EXTENDED,
        triggerSource: ArchiveTriggerSource.SELF_EXTENSION,
      },
    });
  });

  return user.id;
}

// --------------------------------------------------------------------------
// Aggregated runner + stats
// --------------------------------------------------------------------------

export type ArchiveRunReport = {
  neverMigratedArchived: number;
  neverActivatedNudged: number;
  neverActivatedArchived: number;
  inactiveWarned: number;
  inactiveArchived: number;
  errors: Array<{ userId: string; stage: ArchiveCategory; message: string }>;
};

/**
 * Runs all passes. Safe to call manually (admin action) or from a scheduled
 * cron. Errors per-user are collected so one bad user doesn't stop the run.
 */
export async function runArchivePasses(
  triggerSource: ArchiveTriggerSource,
  actorId?: string | null,
  now: Date = new Date()
): Promise<ArchiveRunReport> {
  const report: ArchiveRunReport = {
    neverMigratedArchived: 0,
    neverActivatedNudged: 0,
    neverActivatedArchived: 0,
    inactiveWarned: 0,
    inactiveArchived: 0,
    errors: [],
  };

  // 1. Never migrated — archive immediately
  const neverMigrated = await prisma.user.findMany({
    where: whereNeverMigrated(),
    select: { id: true },
  });
  for (const u of neverMigrated) {
    try {
      await archiveUser({
        userId: u.id,
        reason: ArchiveReason.NEVER_MIGRATED,
        triggerSource,
        actorId,
      });
      report.neverMigratedArchived++;
    } catch (e) {
      report.errors.push({
        userId: u.id,
        stage: "never-migrated",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 2. Never activated — 1mo nudge
  const nudgeCandidates = await prisma.user.findMany({
    where: whereNeverActivatedNudge(now),
    select: { id: true },
  });
  for (const u of nudgeCandidates) {
    try {
      await sendFirstShiftNudge({ userId: u.id, triggerSource, actorId });
      report.neverActivatedNudged++;
    } catch (e) {
      report.errors.push({
        userId: u.id,
        stage: "never-activated-nudge",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 3. Never activated — 3mo archive
  const neverActivatedArchive = await prisma.user.findMany({
    where: whereNeverActivatedArchive(now),
    select: { id: true },
  });
  for (const u of neverActivatedArchive) {
    try {
      await archiveUser({
        userId: u.id,
        reason: ArchiveReason.NEVER_ACTIVATED,
        triggerSource,
        actorId,
      });
      report.neverActivatedArchived++;
    } catch (e) {
      report.errors.push({
        userId: u.id,
        stage: "never-activated-archive",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 4. Inactive 11mo warning
  const warnings = await getInactiveWarningCandidates(now);
  for (const u of warnings) {
    try {
      await sendInactiveWarning({ userId: u.id, triggerSource, actorId });
      report.inactiveWarned++;
    } catch (e) {
      report.errors.push({
        userId: u.id,
        stage: "inactive-warning",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 5. Inactive 12mo archive
  const archives = await getInactiveArchiveCandidates(now);
  for (const u of archives) {
    try {
      await archiveUser({
        userId: u.id,
        reason: ArchiveReason.INACTIVE_12_MONTHS,
        triggerSource,
        actorId,
      });
      report.inactiveArchived++;
    } catch (e) {
      report.errors.push({
        userId: u.id,
        stage: "inactive-archive",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return report;
}

export type ArchiveStats = {
  archivedTotal: number;
  archivedByReason: Record<ArchiveReason, number>;
  pending: Record<ArchiveCategory, number>;
};

export async function getArchiveStats(now: Date = new Date()): Promise<ArchiveStats> {
  const [archivedByReason, neverMigrated, nudgeCandidates, archiveCandidates] =
    await Promise.all([
      prisma.user.groupBy({
        by: ["archiveReason"],
        where: { archivedAt: { not: null } },
        _count: { _all: true },
      }),
      prisma.user.count({ where: whereNeverMigrated() }),
      prisma.user.count({ where: whereNeverActivatedNudge(now) }),
      prisma.user.count({ where: whereNeverActivatedArchive(now) }),
    ]);

  const [inactiveWarnings, inactiveArchives] = await Promise.all([
    getInactiveWarningCandidates(now),
    getInactiveArchiveCandidates(now),
  ]);

  const byReason: Record<ArchiveReason, number> = {
    [ArchiveReason.INACTIVE_12_MONTHS]: 0,
    [ArchiveReason.NEVER_ACTIVATED]: 0,
    [ArchiveReason.NEVER_MIGRATED]: 0,
    [ArchiveReason.MANUAL]: 0,
  };
  for (const row of archivedByReason) {
    if (row.archiveReason) byReason[row.archiveReason] = row._count._all;
  }

  const archivedTotal = Object.values(byReason).reduce((a, b) => a + b, 0);

  return {
    archivedTotal,
    archivedByReason: byReason,
    pending: {
      "never-migrated": neverMigrated,
      "never-activated-nudge": nudgeCandidates,
      "never-activated-archive": archiveCandidates,
      "inactive-warning": inactiveWarnings.length,
      "inactive-archive": inactiveArchives.length,
    },
  };
}

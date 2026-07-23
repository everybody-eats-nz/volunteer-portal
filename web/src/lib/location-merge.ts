import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { renameLocationInStoredList } from "@/lib/parse-availability";
import { formatInNZT } from "@/lib/timezone";

/**
 * Merge one location into another after an accidental duplication.
 *
 * Location names are the join key across the whole schema (Shift,
 * ShiftTemplate, MealsServed, ...), so a duplicated location — e.g. a
 * pre-cascade rename that left old-name rows behind, or a seed re-run
 * resurrecting a renamed-away name — leaves shifts, templates and settings
 * split across two names. planLocationMerge computes what folding `from`
 * into `into` would touch; applyLocationMerge recomputes that plan inside a
 * transaction (so the preview can never act on stale data) and executes it.
 *
 * Per-table policy (conservative — nothing with volunteer data is deleted):
 *   Shift             empty duplicates (no signups/placeholders, identical
 *                     shiftType+start+end twin already at `into`) are
 *                     deleted; everything else is repointed. Non-empty twins
 *                     are repointed and reported for manual consolidation.
 *   ShiftTemplate     deleted when `into` already has a template of the same
 *                     name (the resurrected seed copies), repointed otherwise.
 *   MealsServed       repointed; on a (date, location) collision the `into`
 *                     row wins, blank fields are back-filled from the `from`
 *                     row, and the `from` row is deleted.
 *   DailyMenu         repointed; on collision the `into` row wins and the
 *                     `from` row is deleted (menus are per-night records —
 *                     field-mixing would fabricate a menu nobody wrote).
 *   MessagingHours    repointed; on a (location, dayOfWeek) collision the
 *                     `into` row wins and the `from` row is deleted.
 *   RegularVolunteer, AutoAcceptRule, User.defaultLocation   repointed.
 *   User.availableLocations, RestaurantManager.locations,
 *   Announcement.targetLocations                             rewritten with
 *                     the old name replaced (deduped when both were present).
 *   ShortageNotificationLog                                  left untouched
 *                     (historical log).
 */

/** Raised for caller mistakes (unknown target, same names) — map to a 4xx. */
export class LocationMergeError extends Error {}

export interface MergeShiftDetail {
  id: string;
  /** NZ-local date + shift type, for display */
  date: string;
  shiftTypeName: string;
  signups: number;
  placeholders: number;
}

export interface LocationMergePlan {
  from: string;
  into: string;
  /** False when merging orphaned references with no Location row left. */
  fromLocationExists: boolean;
  shifts: {
    total: number;
    toDelete: MergeShiftDetail[];
    toRepoint: number;
    /** Repointed shifts with signups/walk-ins that now duplicate a twin. */
    twinWarnings: MergeShiftDetail[];
  };
  templates: {
    total: number;
    toDelete: { id: string; name: string }[];
    toRepoint: number;
  };
  mealsServed: { total: number; collisionDates: string[] };
  dailyMenus: { total: number; collisionDates: string[] };
  messagingHours: { total: number; collisions: number };
  regularVolunteers: number;
  autoAcceptRules: number;
  usersDefaultLocation: number;
  usersAvailableLocations: number;
  restaurantManagers: number;
  announcements: number;
}

type Db = Prisma.TransactionClient;

interface MergeShiftRow {
  id: string;
  shiftTypeId: string;
  start: Date;
  end: Date;
  shiftType: { name: string };
  _count: { signups: number; placeholders: number };
}

export function shiftMergeKey(shift: {
  shiftTypeId: string;
  start: Date;
  end: Date;
}): string {
  return `${shift.shiftTypeId}|${shift.start.toISOString()}|${shift.end.toISOString()}`;
}

/**
 * Split the duplicate location's shifts into deletions (empty + identical
 * twin at the target) and repoints, flagging repointed twins that still hold
 * signups/walk-ins. Pure — exported for unit tests.
 */
export function partitionShiftsForMerge<
  T extends {
    shiftTypeId: string;
    start: Date;
    end: Date;
    _count: { signups: number; placeholders: number };
  }
>(fromShifts: T[], intoShiftKeys: Set<string>) {
  const toDelete: T[] = [];
  const toRepoint: T[] = [];
  const twinWarnings: T[] = [];
  for (const shift of fromShifts) {
    const hasTwin = intoShiftKeys.has(shiftMergeKey(shift));
    const isEmpty =
      shift._count.signups === 0 && shift._count.placeholders === 0;
    if (hasTwin && isEmpty) {
      toDelete.push(shift);
    } else {
      toRepoint.push(shift);
      if (hasTwin) twinWarnings.push(shift);
    }
  }
  return { toDelete, toRepoint, twinWarnings };
}

/** Internal working set the apply step acts on. */
interface MergeWork {
  fromLocationId: string | null;
  shiftIdsToDelete: string[];
  shiftIdsToRepoint: string[];
  templateIdsToDelete: string[];
  templateIdsToRepoint: string[];
  mealCollisions: Prisma.MealsServedGetPayload<object>[];
  menuCollisionIds: string[];
  hourCollisionIds: string[];
  availableRewrites: { id: string; rewritten: string }[];
}

function toShiftDetail(shift: MergeShiftRow): MergeShiftDetail {
  return {
    id: shift.id,
    date: formatInNZT(shift.start, "d MMM yyyy"),
    shiftTypeName: shift.shiftType.name,
    signups: shift._count.signups,
    placeholders: shift._count.placeholders,
  };
}

async function computeMerge(
  db: Db,
  from: string,
  into: string
): Promise<{ plan: LocationMergePlan; work: MergeWork }> {
  if (!from.trim() || !into.trim() || from === into) {
    throw new LocationMergeError(
      "Provide two different location names to merge"
    );
  }

  const [fromRow, intoRow] = await Promise.all([
    db.location.findUnique({ where: { name: from } }),
    db.location.findUnique({ where: { name: into } }),
  ]);
  if (!intoRow) {
    throw new LocationMergeError(`Target location "${into}" does not exist`);
  }

  const [fromShifts, intoShifts, fromTemplates, intoTemplates] =
    await Promise.all([
      db.shift.findMany({
        where: { location: from },
        select: {
          id: true,
          shiftTypeId: true,
          start: true,
          end: true,
          shiftType: { select: { name: true } },
          _count: { select: { signups: true, placeholders: true } },
        },
        orderBy: { start: "asc" },
      }),
      db.shift.findMany({
        where: { location: into },
        select: { shiftTypeId: true, start: true, end: true },
      }),
      db.shiftTemplate.findMany({ where: { location: from } }),
      db.shiftTemplate.findMany({
        where: { location: into },
        select: { name: true },
      }),
    ]);

  const intoShiftKeys = new Set(intoShifts.map(shiftMergeKey));
  const {
    toDelete: shiftsToDelete,
    toRepoint: shiftsToRepoint,
    twinWarnings,
  } = partitionShiftsForMerge(fromShifts, intoShiftKeys);

  const intoTemplateNames = new Set(intoTemplates.map((t) => t.name));
  const templatesToDelete = fromTemplates.filter((t) =>
    intoTemplateNames.has(t.name)
  );
  const templatesToRepoint = fromTemplates.filter(
    (t) => !intoTemplateNames.has(t.name)
  );

  const [fromMeals, intoMeals, fromMenus, intoMenus, fromHours, intoHours] =
    await Promise.all([
      db.mealsServed.findMany({ where: { location: from } }),
      db.mealsServed.findMany({
        where: { location: into },
        select: { date: true },
      }),
      db.dailyMenu.findMany({
        where: { location: from },
        select: { id: true, date: true },
      }),
      db.dailyMenu.findMany({
        where: { location: into },
        select: { date: true },
      }),
      db.messagingHours.findMany({
        where: { location: from },
        select: { id: true, dayOfWeek: true },
      }),
      db.messagingHours.findMany({
        where: { location: into },
        select: { dayOfWeek: true },
      }),
    ]);

  const intoMealDates = new Set(intoMeals.map((m) => m.date.toISOString()));
  const mealCollisions = fromMeals.filter((m) =>
    intoMealDates.has(m.date.toISOString())
  );
  const intoMenuDates = new Set(intoMenus.map((m) => m.date.toISOString()));
  const menuCollisions = fromMenus.filter((m) =>
    intoMenuDates.has(m.date.toISOString())
  );
  const intoHourDays = new Set(intoHours.map((h) => h.dayOfWeek));
  const hourCollisions = fromHours.filter((h) =>
    intoHourDays.has(h.dayOfWeek)
  );

  const [
    regularVolunteers,
    autoAcceptRules,
    usersDefaultLocation,
    usersWithOldAvailable,
    restaurantManagers,
    announcements,
  ] = await Promise.all([
    db.regularVolunteer.count({ where: { location: from } }),
    db.autoAcceptRule.count({ where: { location: from } }),
    db.user.count({ where: { defaultLocation: from } }),
    db.user.findMany({
      where: { availableLocations: { contains: from } },
      select: { id: true, availableLocations: true },
    }),
    db.restaurantManager.count({ where: { locations: { has: from } } }),
    db.announcement.count({ where: { targetLocations: { has: from } } }),
  ]);

  // The contains filter over-matches substrings; the helper only rewrites
  // rows whose parsed entries actually include the old name.
  const availableRewrites = usersWithOldAvailable
    .map((u) => ({
      id: u.id,
      rewritten: renameLocationInStoredList(u.availableLocations, from, into),
    }))
    .filter(
      (u): u is { id: string; rewritten: string } => u.rewritten !== null
    );

  // MealsServed dates are NZ-midnight stored in UTC — format via NZT or the
  // date lands a day early.
  const nzDate = (d: Date) => formatInNZT(d, "d MMM yyyy");

  return {
    plan: {
      from,
      into,
      fromLocationExists: fromRow !== null,
      shifts: {
        total: fromShifts.length,
        toDelete: shiftsToDelete.map(toShiftDetail),
        toRepoint: shiftsToRepoint.length,
        twinWarnings: twinWarnings.map(toShiftDetail),
      },
      templates: {
        total: fromTemplates.length,
        toDelete: templatesToDelete.map((t) => ({ id: t.id, name: t.name })),
        toRepoint: templatesToRepoint.length,
      },
      mealsServed: {
        total: fromMeals.length,
        collisionDates: mealCollisions.map((m) => nzDate(m.date)),
      },
      dailyMenus: {
        total: fromMenus.length,
        collisionDates: menuCollisions.map((m) => nzDate(m.date)),
      },
      messagingHours: {
        total: fromHours.length,
        collisions: hourCollisions.length,
      },
      regularVolunteers,
      autoAcceptRules,
      usersDefaultLocation,
      usersAvailableLocations: availableRewrites.length,
      restaurantManagers,
      announcements,
    },
    work: {
      fromLocationId: fromRow?.id ?? null,
      shiftIdsToDelete: shiftsToDelete.map((s) => s.id),
      shiftIdsToRepoint: shiftsToRepoint.map((s) => s.id),
      templateIdsToDelete: templatesToDelete.map((t) => t.id),
      templateIdsToRepoint: templatesToRepoint.map((t) => t.id),
      mealCollisions,
      menuCollisionIds: menuCollisions.map((m) => m.id),
      hourCollisionIds: hourCollisions.map((h) => h.id),
      availableRewrites,
    },
  };
}

/** Read-only preview of what a merge would do. */
export async function planLocationMerge(
  from: string,
  into: string
): Promise<LocationMergePlan> {
  const { plan } = await computeMerge(prisma, from, into);
  return plan;
}

const MEAL_BACKFILL_FIELDS = [
  "mealsServed",
  "notes",
  "weather",
  "bookingsPax",
  "newVolunteers",
  "nonPayingCount",
  "vege",
  "takeaways",
  "eftposTransactions",
  "cash",
  "eftpos",
  "stripe",
  "suggestedValue",
  "protein",
] as const;

/**
 * Execute the merge. The plan is recomputed inside the transaction, so a
 * previously previewed plan can never act on stale data; the returned plan
 * reflects exactly what was applied.
 */
export async function applyLocationMerge(
  from: string,
  into: string
): Promise<LocationMergePlan> {
  return prisma.$transaction(async (tx) => {
    const { plan, work } = await computeMerge(tx, from, into);

    if (work.shiftIdsToDelete.length > 0) {
      await tx.shift.deleteMany({
        where: { id: { in: work.shiftIdsToDelete } },
      });
    }
    if (work.shiftIdsToRepoint.length > 0) {
      await tx.shift.updateMany({
        where: { id: { in: work.shiftIdsToRepoint } },
        data: { location: into },
      });
    }

    if (work.templateIdsToDelete.length > 0) {
      await tx.shiftTemplate.deleteMany({
        where: { id: { in: work.templateIdsToDelete } },
      });
    }
    if (work.templateIdsToRepoint.length > 0) {
      await tx.shiftTemplate.updateMany({
        where: { id: { in: work.templateIdsToRepoint } },
        data: { location: into },
      });
    }

    // MealsServed collisions: back-fill blank fields on the surviving row,
    // then drop the duplicate so the repoint below can't violate the
    // (date, location) unique constraint.
    for (const fromMeal of work.mealCollisions) {
      const intoMeal = await tx.mealsServed.findUnique({
        where: { date_location: { date: fromMeal.date, location: into } },
      });
      if (intoMeal) {
        const backfill: Record<string, unknown> = {};
        for (const field of MEAL_BACKFILL_FIELDS) {
          if (intoMeal[field] === null && fromMeal[field] !== null) {
            backfill[field] = fromMeal[field];
          }
        }
        if (Object.keys(backfill).length > 0) {
          await tx.mealsServed.update({
            where: { id: intoMeal.id },
            data: backfill,
          });
        }
      }
      await tx.mealsServed.delete({ where: { id: fromMeal.id } });
    }
    await tx.mealsServed.updateMany({
      where: { location: from },
      data: { location: into },
    });

    if (work.menuCollisionIds.length > 0) {
      await tx.dailyMenu.deleteMany({
        where: { id: { in: work.menuCollisionIds } },
      });
    }
    await tx.dailyMenu.updateMany({
      where: { location: from },
      data: { location: into },
    });

    if (work.hourCollisionIds.length > 0) {
      await tx.messagingHours.deleteMany({
        where: { id: { in: work.hourCollisionIds } },
      });
    }
    await tx.messagingHours.updateMany({
      where: { location: from },
      data: { location: into },
    });

    await tx.regularVolunteer.updateMany({
      where: { location: from },
      data: { location: into },
    });
    await tx.autoAcceptRule.updateMany({
      where: { location: from },
      data: { location: into },
    });
    await tx.user.updateMany({
      where: { defaultLocation: from },
      data: { defaultLocation: into },
    });

    for (const { id, rewritten } of work.availableRewrites) {
      await tx.user.update({
        where: { id },
        data: { availableLocations: rewritten },
      });
    }

    await tx.$executeRaw`
      UPDATE "RestaurantManager"
      SET "locations" = (
        SELECT COALESCE(array_agg(DISTINCT loc), '{}')
        FROM unnest(array_replace("locations", ${from}, ${into})) AS loc
      )
      WHERE ${from} = ANY("locations")
    `;
    await tx.$executeRaw`
      UPDATE "Announcement"
      SET "targetLocations" = (
        SELECT COALESCE(array_agg(DISTINCT loc), '{}')
        FROM unnest(array_replace("targetLocations", ${from}, ${into})) AS loc
      )
      WHERE ${from} = ANY("targetLocations")
    `;

    if (work.fromLocationId) {
      await tx.location.delete({ where: { id: work.fromLocationId } });
    }

    return plan;
  });
}

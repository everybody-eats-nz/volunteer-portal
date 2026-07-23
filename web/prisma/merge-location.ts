/**
 * Merge one location into another after an accidental duplication.
 *
 * Location names are the join key across the whole schema (Shift,
 * ShiftTemplate, MealsServed, ...), so a location that got duplicated — e.g.
 * a pre-cascade rename that left old-name rows behind, or a re-run of
 * seed-production.ts resurrecting a renamed-away name — leaves shifts,
 * templates and settings split across two (or more) names. This script folds
 * everything filed under --from into --into and deletes the duplicate
 * Location row.
 *
 * Per-table policy (conservative — nothing with volunteer data is deleted):
 *   Shift             empty duplicates (no signups/placeholders, identical
 *                     shiftType+start+end twin already at --into) are deleted;
 *                     everything else is repointed. Non-empty twins are
 *                     repointed and reported for manual consolidation.
 *   ShiftTemplate     deleted when --into already has a template of the same
 *                     name (the resurrected seed copies), repointed otherwise.
 *   MealsServed       repointed; on a (date, location) collision the --into
 *                     row wins, blank fields are back-filled from the --from
 *                     row, and the --from row is deleted.
 *   DailyMenu         repointed; on collision the --into row wins and the
 *                     --from row is deleted (menus are per-night records —
 *                     field-mixing would fabricate a menu nobody wrote).
 *   MessagingHours    repointed; on a (location, dayOfWeek) collision the
 *                     --into row wins and the --from row is deleted.
 *   RegularVolunteer, AutoAcceptRule, User.defaultLocation   repointed.
 *   User.availableLocations, RestaurantManager.locations,
 *   Announcement.targetLocations                             rewritten with
 *                     the old name replaced (deduped when both were present).
 *   ShortageNotificationLog                                  left untouched
 *                     (historical log).
 *
 * Usage:
 *   npx tsx prisma/merge-location.ts --from "Old Name" --into "New Name"           # dry-run
 *   npx tsx prisma/merge-location.ts --from "Old Name" --into "New Name" --apply   # write
 *
 * To fix prod, run locally with DATABASE_URL set to the prod (direct :5432)
 * connection string, exactly like the importers:
 *   DATABASE_URL="<prod-direct-url>" npx tsx prisma/merge-location.ts --from ... --into ... --apply
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { renameLocationInStoredList } from "../src/lib/parse-availability";

// ---- arg parsing -----------------------------------------------------------
const argv = process.argv.slice(2);

function argValue(flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

const fromArg = argValue("--from");
const intoArg = argValue("--into");
const APPLY = argv.includes("--apply");

if (!fromArg || !intoArg || fromArg === intoArg) {
  console.error(
    'Usage: npx tsx prisma/merge-location.ts --from "Old Name" --into "New Name" [--apply]'
  );
  process.exit(1);
}
const FROM = fromArg;
const INTO = intoArg;

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  console.log(
    `${APPLY ? "Merging" : "DRY RUN — would merge"} location "${FROM}" into "${INTO}"\n`
  );

  const [fromRow, intoRow] = await Promise.all([
    prisma.location.findUnique({ where: { name: FROM } }),
    prisma.location.findUnique({ where: { name: INTO } }),
  ]);

  if (!intoRow) {
    console.error(`❌ Target location "${INTO}" does not exist — aborting.`);
    process.exit(1);
  }
  if (!fromRow) {
    console.log(
      `ℹ️  No Location row named "${FROM}" — merging orphaned references only.`
    );
  }

  // ---- build the plan (reads only) ----------------------------------------
  const [fromShifts, intoShifts, fromTemplates, intoTemplates] =
    await Promise.all([
      prisma.shift.findMany({
        where: { location: FROM },
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
      prisma.shift.findMany({
        where: { location: INTO },
        select: { shiftTypeId: true, start: true, end: true },
      }),
      prisma.shiftTemplate.findMany({ where: { location: FROM } }),
      prisma.shiftTemplate.findMany({
        where: { location: INTO },
        select: { name: true },
      }),
    ]);

  const intoShiftKeys = new Set(
    intoShifts.map(
      (s) => `${s.shiftTypeId}|${s.start.toISOString()}|${s.end.toISOString()}`
    )
  );
  const intoTemplateNames = new Set(intoTemplates.map((t) => t.name));

  const shiftsToDelete: typeof fromShifts = [];
  const shiftsToRepoint: typeof fromShifts = [];
  const shiftTwinWarnings: typeof fromShifts = [];
  for (const shift of fromShifts) {
    const hasTwin = intoShiftKeys.has(
      `${shift.shiftTypeId}|${shift.start.toISOString()}|${shift.end.toISOString()}`
    );
    const isEmpty =
      shift._count.signups === 0 && shift._count.placeholders === 0;
    if (hasTwin && isEmpty) {
      shiftsToDelete.push(shift);
    } else {
      shiftsToRepoint.push(shift);
      if (hasTwin) shiftTwinWarnings.push(shift);
    }
  }

  const templatesToDelete = fromTemplates.filter((t) =>
    intoTemplateNames.has(t.name)
  );
  const templatesToRepoint = fromTemplates.filter(
    (t) => !intoTemplateNames.has(t.name)
  );

  const [fromMeals, intoMeals, fromMenus, intoMenus, fromHours, intoHours] =
    await Promise.all([
      prisma.mealsServed.findMany({ where: { location: FROM } }),
      prisma.mealsServed.findMany({
        where: { location: INTO },
        select: { date: true },
      }),
      prisma.dailyMenu.findMany({
        where: { location: FROM },
        select: { id: true, date: true },
      }),
      prisma.dailyMenu.findMany({
        where: { location: INTO },
        select: { date: true },
      }),
      prisma.messagingHours.findMany({ where: { location: FROM } }),
      prisma.messagingHours.findMany({
        where: { location: INTO },
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
  const hourCollisions = fromHours.filter((h) => intoHourDays.has(h.dayOfWeek));

  const [
    regularCount,
    ruleCount,
    defaultLocationCount,
    usersWithOldAvailable,
    managerRows,
    announcementRows,
  ] = await Promise.all([
    prisma.regularVolunteer.count({ where: { location: FROM } }),
    prisma.autoAcceptRule.count({ where: { location: FROM } }),
    prisma.user.count({ where: { defaultLocation: FROM } }),
    prisma.user.findMany({
      where: { availableLocations: { contains: FROM } },
      select: { id: true, availableLocations: true },
    }),
    prisma.restaurantManager.count({ where: { locations: { has: FROM } } }),
    prisma.announcement.count({ where: { targetLocations: { has: FROM } } }),
  ]);

  const availableRewrites = usersWithOldAvailable
    .map((u) => ({
      id: u.id,
      rewritten: renameLocationInStoredList(u.availableLocations, FROM, INTO),
    }))
    .filter((u): u is { id: string; rewritten: string } => u.rewritten !== null);

  // ---- report the plan ------------------------------------------------------
  console.log(`Shifts under "${FROM}": ${fromShifts.length}`);
  console.log(
    `  delete (empty duplicate of an identical "${INTO}" shift): ${shiftsToDelete.length}`
  );
  for (const s of shiftsToDelete) {
    console.log(`    - ${fmtDate(s.start)} ${s.shiftType.name} (${s.id})`);
  }
  console.log(`  repoint to "${INTO}": ${shiftsToRepoint.length}`);
  if (shiftTwinWarnings.length > 0) {
    console.log(
      `  ⚠️  ${shiftTwinWarnings.length} repointed shift(s) have signups/walk-ins AND an identical twin at "${INTO}" — consolidate these by hand in the admin UI:`
    );
    for (const s of shiftTwinWarnings) {
      console.log(
        `    - ${fmtDate(s.start)} ${s.shiftType.name} (${s.id}): ${s._count.signups} signup(s), ${s._count.placeholders} walk-in(s)`
      );
    }
  }

  console.log(`\nShift templates under "${FROM}": ${fromTemplates.length}`);
  console.log(
    `  delete (same template name already at "${INTO}"): ${templatesToDelete.length}`
  );
  for (const t of templatesToDelete) console.log(`    - ${t.name} (${t.id})`);
  console.log(`  repoint: ${templatesToRepoint.length}`);

  console.log(
    `\nMealsServed: ${fromMeals.length} row(s), ${mealCollisions.length} date collision(s) (blank fields back-filled onto the "${INTO}" row, then removed)`
  );
  for (const m of mealCollisions) console.log(`    - ${fmtDate(m.date)}`);
  console.log(
    `DailyMenu: ${fromMenus.length} row(s), ${menuCollisions.length} date collision(s) ("${INTO}" menu wins)`
  );
  for (const m of menuCollisions) console.log(`    - ${fmtDate(m.date)}`);
  console.log(
    `MessagingHours: ${fromHours.length} row(s), ${hourCollisions.length} day collision(s) ("${INTO}" hours win)`
  );
  console.log(`RegularVolunteer rows: ${regularCount}`);
  console.log(`AutoAcceptRule rows: ${ruleCount}`);
  console.log(`Users with defaultLocation "${FROM}": ${defaultLocationCount}`);
  console.log(
    `Users with "${FROM}" in availableLocations: ${availableRewrites.length}`
  );
  console.log(`RestaurantManagers covering "${FROM}": ${managerRows}`);
  console.log(`Announcements targeting "${FROM}": ${announcementRows}`);
  console.log(
    `Location row "${FROM}": ${fromRow ? "delete" : "none (nothing to delete)"}`
  );

  if (!APPLY) {
    console.log("\nDry run — no changes written. Re-run with --apply to merge.");
    return;
  }

  // ---- apply ----------------------------------------------------------------
  console.log("\nApplying…");
  await prisma.$transaction(async (tx) => {
    if (shiftsToDelete.length > 0) {
      await tx.shift.deleteMany({
        where: { id: { in: shiftsToDelete.map((s) => s.id) } },
      });
    }
    if (shiftsToRepoint.length > 0) {
      await tx.shift.updateMany({
        where: { id: { in: shiftsToRepoint.map((s) => s.id) } },
        data: { location: INTO },
      });
    }

    if (templatesToDelete.length > 0) {
      await tx.shiftTemplate.deleteMany({
        where: { id: { in: templatesToDelete.map((t) => t.id) } },
      });
    }
    if (templatesToRepoint.length > 0) {
      await tx.shiftTemplate.updateMany({
        where: { id: { in: templatesToRepoint.map((t) => t.id) } },
        data: { location: INTO },
      });
    }

    // MealsServed collisions: back-fill blank fields on the surviving row,
    // then drop the duplicate so the repoint below can't violate the
    // (date, location) unique constraint.
    for (const fromMeal of mealCollisions) {
      const intoMeal = await tx.mealsServed.findUnique({
        where: { date_location: { date: fromMeal.date, location: INTO } },
      });
      if (intoMeal) {
        const backfill: Record<string, unknown> = {};
        const fields = [
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
        for (const field of fields) {
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
      where: { location: FROM },
      data: { location: INTO },
    });

    if (menuCollisions.length > 0) {
      await tx.dailyMenu.deleteMany({
        where: { id: { in: menuCollisions.map((m) => m.id) } },
      });
    }
    await tx.dailyMenu.updateMany({
      where: { location: FROM },
      data: { location: INTO },
    });

    if (hourCollisions.length > 0) {
      await tx.messagingHours.deleteMany({
        where: { id: { in: hourCollisions.map((h) => h.id) } },
      });
    }
    await tx.messagingHours.updateMany({
      where: { location: FROM },
      data: { location: INTO },
    });

    await tx.regularVolunteer.updateMany({
      where: { location: FROM },
      data: { location: INTO },
    });
    await tx.autoAcceptRule.updateMany({
      where: { location: FROM },
      data: { location: INTO },
    });
    await tx.user.updateMany({
      where: { defaultLocation: FROM },
      data: { defaultLocation: INTO },
    });

    for (const { id, rewritten } of availableRewrites) {
      await tx.user.update({
        where: { id },
        data: { availableLocations: rewritten },
      });
    }

    await tx.$executeRaw`
      UPDATE "RestaurantManager"
      SET "locations" = (
        SELECT COALESCE(array_agg(DISTINCT loc), '{}')
        FROM unnest(array_replace("locations", ${FROM}, ${INTO})) AS loc
      )
      WHERE ${FROM} = ANY("locations")
    `;
    await tx.$executeRaw`
      UPDATE "Announcement"
      SET "targetLocations" = (
        SELECT COALESCE(array_agg(DISTINCT loc), '{}')
        FROM unnest(array_replace("targetLocations", ${FROM}, ${INTO})) AS loc
      )
      WHERE ${FROM} = ANY("targetLocations")
    `;

    if (fromRow) {
      await tx.location.delete({ where: { id: fromRow.id } });
    }
  });

  console.log(`✅ Merged "${FROM}" into "${INTO}".`);
  if (shiftTwinWarnings.length > 0) {
    console.log(
      `⚠️  Remember: ${shiftTwinWarnings.length} duplicate shift(s) with signups/walk-ins now sit alongside their twin at "${INTO}" — consolidate them in the admin UI.`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

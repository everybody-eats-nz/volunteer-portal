import { prisma } from "@/lib/prisma";

/**
 * Estimated kilograms of food saved per meal served.
 *
 * Everybody Eats rescues surplus food and turns it into restaurant-quality
 * meals, so each meal served represents food diverted from landfill. We don't
 * weigh rescued food per service, so we estimate weight from meals served using
 * the industry-standard food-rescue conversion (~0.5 kg per meal, as used by
 * OzHarvest / FoodCloud). This is the single source of truth for the factor —
 * the marketing site only displays the computed value.
 */
export const FOOD_SAVED_KG_PER_MEAL = 0.5;

export type PublicImpactStats = {
  /** Total customers served across all service nights (a.k.a. meals served). */
  peopleServed: number;
  /** Total volunteer hours logged across all completed, confirmed shifts. */
  volunteerHours: number;
  /** Estimated kilograms of food saved, derived from people served. */
  foodSavedKg: number;
  /** The conversion factor used to derive `foodSavedKg`, for transparency. */
  foodSavedKgPerMeal: number;
  /** ISO timestamp the figures were computed. */
  generatedAt: string;
};

/**
 * Total volunteer hours logged across every CONFIRMED signup whose shift has
 * finished, as of `now`. Computed in SQL (`SUM` over shift durations) so there
 * is no row cap — the single source of truth for the headline hours figure,
 * shared by the public endpoint and the home landing page.
 */
export async function getConfirmedVolunteerHours(now: Date): Promise<number> {
  const hoursRows = await prisma.$queryRaw<{ seconds: number | null }[]>`
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (s."end" - s."start"))), 0)::float8 AS seconds
    FROM "Signup" sg
    JOIN "Shift" s ON s.id = sg."shiftId"
    WHERE sg.status = 'CONFIRMED' AND s."end" < ${now}
  `;
  return Math.round((hoursRows[0]?.seconds ?? 0) / 3600);
}

/**
 * Count of distinct volunteers who have actually done a shift, as of `now` —
 * i.e. people with at least one CONFIRMED signup whose shift has finished.
 * Uses the same CONFIRMED + finished-shift basis as the hours figure, so the
 * two headline numbers tell a consistent story. This is the single source of
 * truth, shared by the public endpoint and the home landing page; it counts
 * people who showed up, not everyone who ever registered an account.
 */
export async function getActiveVolunteerCount(now: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number | null }[]>`
    SELECT COUNT(DISTINCT sg."userId")::int AS count
    FROM "Signup" sg
    JOIN "Shift" s ON s.id = sg."shiftId"
    WHERE sg.status = 'CONFIRMED' AND s."end" < ${now}
  `;
  return rows[0]?.count ?? 0;
}

/**
 * Computes the headline impact figures shared publicly (e.g. on the marketing
 * site). Kept deliberately lean — only the three numbers we expose — so it can
 * back a cacheable public endpoint without the heavier home-dashboard queries.
 *
 * - `peopleServed`: sum of recorded customers served (`MealsServed.mealsServed`).
 * - `volunteerHours`: sum of `(shift.end - shift.start)` for every CONFIRMED
 *   signup whose shift has finished. Computed in SQL so there's no row cap.
 */
export async function getPublicImpactStats(): Promise<PublicImpactStats> {
  const now = new Date();

  const [mealsAggregate, volunteerHours] = await Promise.all([
    prisma.mealsServed.aggregate({ _sum: { mealsServed: true } }),
    getConfirmedVolunteerHours(now),
  ]);

  const peopleServed = mealsAggregate._sum.mealsServed ?? 0;
  const foodSavedKg = Math.round(peopleServed * FOOD_SAVED_KG_PER_MEAL);

  return {
    peopleServed,
    volunteerHours,
    foodSavedKg,
    foodSavedKgPerMeal: FOOD_SAVED_KG_PER_MEAL,
    generatedAt: now.toISOString(),
  };
}

import { Prisma } from "@/generated/client";

/**
 * Who counts as "in the volunteer programme", as opposed to merely "has a
 * login".
 *
 * The van log gives accounts to people who drive an Everybody Eats van but were
 * never volunteers: a Sustainability Trust driver borrowing the van is a `User`
 * row with the default `role: VOLUNTEER`, because driving is a capability
 * (`DriverProfile`) rather than a role. Left alone they would be counted in
 * volunteer analytics, appear on the leaderboard, receive volunteer bulk email,
 * and — worst — be swept up by the inactivity archiver and emailed "we miss
 * you" for not taking shifts they were never part of.
 *
 * The rule is derived rather than stored: an external driver is somebody whose
 * `DriverProfile` belongs to a non-internal `Organisation`. Nothing has to be
 * remembered at write time, and moving a driver's organisation moves them
 * between the two populations on its own.
 *
 * This module is the only place that rule is written down. Every consumer takes
 * one of the three exports below rather than hand-rolling the join, so the
 * definition cannot drift between the leaderboard and the archiver.
 */

/**
 * Prisma `UserWhereInput` fragment. Spread it into a `where` alongside whatever
 * else the query needs:
 *
 * ```ts
 * prisma.user.findMany({
 *   where: { role: "VOLUNTEER", archivedAt: null, ...inVolunteerProgramme },
 * });
 * ```
 *
 * Reads as "no driver profile, or a driver profile belonging to an internal
 * organisation" — a plain volunteer has no `DriverProfile` at all and passes.
 */
export const inVolunteerProgramme = {
  NOT: {
    driverProfile: {
      is: { organisation: { is: { isInternal: false } } },
    },
  },
} satisfies Prisma.UserWhereInput;

/**
 * The same rule as a raw-SQL predicate, for the analytics queries that are
 * hand-written SQL. Pass the alias the `User` table has in that query:
 *
 * ```ts
 * prisma.$queryRaw`
 *   SELECT ... FROM "User" u
 *   WHERE u.role = 'VOLUNTEER' AND ${inVolunteerProgrammeSql("u")}
 * `;
 * ```
 */
export function inVolunteerProgrammeSql(userAlias: string): Prisma.Sql {
  // The alias is a compile-time literal at every call site, never user input,
  // but go through Prisma.raw explicitly so that stays obvious.
  const alias = Prisma.raw(`"${userAlias.replace(/"/g, "")}"`);
  return Prisma.sql`NOT EXISTS (
    SELECT 1
    FROM "DriverProfile" dp
    JOIN "Organisation" org ON org.id = dp."organisationId"
    WHERE dp."userId" = ${alias}.id
      AND org."isInternal" = FALSE
  )`;
}

/**
 * In-memory form, for code that already has the user loaded. Include
 * `driverProfile: { include: { organisation: true } }` to use it.
 */
export function isExternalDriver(user: {
  driverProfile?: { organisation?: { isInternal: boolean } | null } | null;
}): boolean {
  return user.driverProfile?.organisation?.isInternal === false;
}

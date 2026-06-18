import { prisma } from "@/lib/prisma";

/**
 * Count "new volunteers" for a service night — confirmed attendees at the given
 * location/day who have no earlier confirmed shift anywhere. This mirrors the
 * org-wide "first shift" definition used by recruitment analytics
 * (earliest CONFIRMED signup; see src/lib/recruitment-users.ts).
 *
 * `start`/`end` are the UTC bounds of the NZ service day.
 */
export async function countNewVolunteers(params: {
  location: string;
  start: Date;
  end: Date;
}): Promise<number> {
  const { location, start, end } = params;

  const attendees = await prisma.signup.findMany({
    where: {
      status: "CONFIRMED",
      shift: { location, start: { gte: start, lte: end } },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  const attendeeIds = attendees.map((a) => a.userId);
  if (attendeeIds.length === 0) return 0;

  // Attendees who already had a confirmed shift before this day are "returning".
  const returning = await prisma.signup.findMany({
    where: {
      status: "CONFIRMED",
      userId: { in: attendeeIds },
      shift: { start: { lt: start } },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  return attendeeIds.length - returning.length;
}

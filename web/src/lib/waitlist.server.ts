/**
 * Server-only waitlist counts. Uses Prisma, so import from server components
 * and API routes only. Pair with the copy helpers in `@/lib/waitlist`.
 */

import { prisma } from "@/lib/prisma";

/** How many volunteers are waitlisted for a single shift. */
export async function getWaitlistCount(shiftId: string): Promise<number> {
  return prisma.signup.count({
    where: { shiftId, status: "WAITLISTED" },
  });
}

/**
 * Waitlist size for many shifts at once, keyed by shift id. Shifts with an
 * empty waitlist are absent from the map — read it with `?? 0`.
 */
export async function getWaitlistCounts(
  shiftIds: string[]
): Promise<Map<string, number>> {
  if (shiftIds.length === 0) return new Map();

  const grouped = await prisma.signup.groupBy({
    by: ["shiftId"],
    where: { shiftId: { in: shiftIds }, status: "WAITLISTED" },
    _count: { _all: true },
  });

  return new Map(grouped.map((row) => [row.shiftId, row._count._all]));
}

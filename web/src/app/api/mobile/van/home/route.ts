import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { firstNameOf, formatDay, formatKm, formatOdo } from "@/lib/van/format";
import { requireMobileDriver } from "@/lib/van/mobile-guard";
import {
  groupTripsByDay,
  toOpenTrip,
  toTripSummary,
} from "@/lib/van/mobile-payloads";
import { getFleetStatus, getStartOptions } from "@/lib/van/queries";
import { tripInclude } from "@/lib/van/trips";

/**
 * GET /api/mobile/van/home
 *
 * Everything the Drive tab paints, in one request — including the
 * organisations, purposes and "same as last time" shortcut the *next* screen
 * needs. Starting a trip has a twenty-second budget and the driver is often on
 * one bar in a loading bay, so the reference data is already in memory by the
 * time they tap a van: the only request on the critical path is the photo
 * upload, which is deliberately off it too.
 */
export async function GET(request: Request) {
  const auth = await requireMobileDriver(request);
  if (auth.denied) return auth.denied;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [fleet, open, closed, recent, options] = await Promise.all([
    getFleetStatus(),
    // Asked for on its own rather than picked out of the page below. A trip
    // left open on Friday sorts behind everything logged since, so on any
    // page short enough to be worth sending it would fall off the end — and
    // the driver would open the tab to no sign of the van they still have.
    prisma.trip.findFirst({
      where: { driverId: auth.userId, status: "OPEN" },
      include: tripInclude,
      orderBy: { startedAt: "desc" },
    }),
    prisma.trip.findMany({
      where: { driverId: auth.userId, status: { not: "OPEN" } },
      include: tripInclude,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      // The tab shows a handful and links to the full history, so this is
      // sized for what it paints, not for the sum below.
      take: 12,
    }),
    // Summed in the database over the whole window. Adding up the page
    // instead understated the number for exactly the drivers it flatters —
    // anyone with more trips in a month than the page holds.
    prisma.trip.aggregate({
      where: {
        driverId: auth.userId,
        status: { not: "OPEN" },
        startedAt: { gte: thirtyDaysAgo },
      },
      _sum: { distanceKm: true },
    }),
    getStartOptions(auth.userId),
  ]);

  const recentKm = recent._sum.distanceKm ?? 0;

  return NextResponse.json({
    firstName: firstNameOf(auth.user.name ?? auth.user.email),
    todayLabel: formatDay(now),
    recentKm,
    recentKmLabel: formatKm(recentKm),
    openTrip: open ? toOpenTrip(open, now) : null,
    fleet: fleet.map((vehicle) => ({
      ...vehicle,
      currentOdoLabel: formatOdo(vehicle.currentOdo),
      // "Out with Sam" reads differently when Sam is you: the van is not
      // unavailable, it is the trip you are in the middle of.
      isMine: vehicle.openTrip?.holderId === auth.userId,
    })),
    days: groupTripsByDay(closed.map(toTripSummary)),
    options,
  });
}

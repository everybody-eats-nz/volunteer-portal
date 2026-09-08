import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatKm } from "@/lib/van/format";
import { requireMobileDriver } from "@/lib/van/mobile-guard";
import { groupTripsByDay, toTripSummary } from "@/lib/van/mobile-payloads";
import { checkStartTripRequest, startTripSchema } from "@/lib/van/requests";
import { startTrip, tripInclude, TripError } from "@/lib/van/trips";

const PAGE_SIZE = 40;

/**
 * GET /api/mobile/van/trips — the driver's own history, a page at a time.
 *
 * Only ever their own. A driver's history is their record of what they did;
 * the fleet-wide view is the office's, and it lives behind the admin guard.
 */
export async function GET(request: Request) {
  const auth = await requireMobileDriver(request);
  if (auth.denied) return auth.denied;

  const cursor = new URL(request.url).searchParams.get("cursor");

  const trips = await prisma.trip.findMany({
    where: { driverId: auth.userId, status: { not: "OPEN" } },
    include: tripInclude,
    // Ordered on id as well as time: a cursor over a non-unique sort key can
    // skip or repeat rows when two trips share a startedAt to the millisecond.
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = trips.slice(0, PAGE_SIZE);
  const totalKm = page.reduce((sum, t) => sum + (t.distanceKm ?? 0), 0);

  return NextResponse.json({
    days: groupTripsByDay(page.map(toTripSummary)),
    pageKm: totalKm,
    pageKmLabel: formatKm(totalKm),
    nextCursor: trips.length > PAGE_SIZE ? page[page.length - 1].id : null,
  });
}

/**
 * POST /api/mobile/van/trips — open a trip, closing whatever was open on that
 * van with the same reading.
 *
 * The app's counterpart to `POST /api/van/trips`. Both are thin: the write
 * itself is `startTrip`, so the odometer chain every exception rule reads has
 * exactly one author however the driver arrived.
 */
export async function POST(request: Request) {
  const auth = await requireMobileDriver(request);
  if (auth.denied) return auth.denied;

  const parsed = startTripSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That trip is missing something." },
      { status: 400 }
    );
  }

  const problem = await checkStartTripRequest(parsed.data);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const { trip, closedTripId } = await startTrip({
      ...parsed.data,
      driverId: auth.userId,
    });
    return NextResponse.json(
      { tripId: trip.id, closedTripId },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof TripError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "RACED" ? 409 : 400 }
      );
    }
    console.error("Mobile start trip error:", error);
    return NextResponse.json(
      { error: "Could not start the trip." },
      { status: 500 }
    );
  }
}

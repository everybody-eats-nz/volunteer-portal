import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileDriver } from "@/lib/van/mobile-guard";
import { toTripDetail } from "@/lib/van/mobile-payloads";
import { tripNotesSchema } from "@/lib/van/requests";
import { setTripNotes, tripInclude, TripError } from "@/lib/van/trips";

/** GET /api/mobile/van/trips/[tripId] — one trip, as its driver sees it. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const auth = await requireMobileDriver(request);
  if (auth.denied) return auth.denied;

  const { tripId } = await params;
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: tripInclude,
  });
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  // A driver reads their own trips and the ones they closed on the way into a
  // van. Anything else is the office's view, which lives behind the admin
  // guard on the web.
  const mine =
    trip.driverId === auth.userId || trip.endedByUserId === auth.userId;
  if (!mine && auth.user.role !== "ADMIN") {
    return NextResponse.json({ error: "That is not your trip" }, { status: 403 });
  }

  return NextResponse.json({
    trip: toTripDetail(trip, auth.userId, new Date()),
  });
}

/**
 * PATCH /api/mobile/van/trips/[tripId] — the optional note.
 *
 * Lives after the trip has started rather than in the way of it, so nothing
 * about writing one is on the critical path of getting the van moving.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const auth = await requireMobileDriver(request);
  if (auth.denied) return auth.denied;

  const { tripId } = await params;
  const parsed = tripNotesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid note." }, { status: 400 });
  }

  try {
    await setTripNotes(
      tripId,
      auth.userId,
      auth.user.role === "ADMIN",
      parsed.data.notes
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TripError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Mobile trip notes error:", error);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { endTrip, TripError } from "@/lib/van/trips";

const endTripSchema = z.object({
  endOdo: z.number().int().positive(),
  endOdoPhotoUrl: z.string().nullable(),
  /** The driver was warned the reading looked wrong and confirmed it anyway. */
  acknowledgedWarning: z.boolean().default(false),
});

/**
 * POST /api/van/trips/[tripId]/end
 *
 * Warn, never block. The only refusal is an end reading at or below the start
 * reading, which cannot be what the dial says and which the driver can see and
 * correct on the same screen. Everything else records the trip and tells the
 * office.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await params;
  const parsed = endTripSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing a reading." }, { status: 400 });
  }

  try {
    const trip = await endTrip({
      tripId,
      userId: session.user.id,
      isAdmin: session.user.role === "ADMIN",
      ...parsed.data,
    });
    return NextResponse.json({
      tripId: trip.id,
      distanceKm: trip.distanceKm,
      endedAt: trip.endedAt,
    });
  } catch (error) {
    if (error instanceof TripError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "NOT_YOUR_TRIP" ? 403 : 400 }
      );
    }
    console.error("End trip error:", error);
    return NextResponse.json(
      { error: "Could not end the trip." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { formatDuration, formatKm } from "@/lib/van/format";
import { requireMobileDriver } from "@/lib/van/mobile-guard";
import { endTripSchema } from "@/lib/van/requests";
import { endTrip, previewEndTrip, TripError } from "@/lib/van/trips";

/**
 * POST /api/mobile/van/trips/[tripId]/end
 *
 * Warn, never block. The only refusal is an end reading at or below the start
 * reading, which cannot be what the dial says and which the driver can see and
 * correct on the same screen. Everything else records the trip and tells the
 * office.
 *
 * The plausibility check runs *here* rather than on the phone. The browser
 * flow can import `plausibility.ts` directly; React Native cannot, and
 * retyping the thresholds in the app is exactly the drift that module exists
 * to prevent — a trip that warned the driver and then looked clean to the
 * office. So an unconfirmed reading that looks wrong comes back as
 * `needsConfirmation` with the sentence the office would read, and the driver
 * confirms against the same rule.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const auth = await requireMobileDriver(request);
  if (auth.denied) return auth.denied;

  const { tripId } = await params;
  const parsed = endTripSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing a reading." }, { status: 400 });
  }
  const { endOdo, endOdoPhotoUrl, acknowledgedWarning } = parsed.data;
  const isAdmin = auth.user.role === "ADMIN";

  try {
    const preview = await previewEndTrip({
      tripId,
      userId: auth.userId,
      isAdmin,
      endOdo,
    });

    // Nothing is written on the way past the warning. The driver sees it,
    // fixes a mistyped digit or confirms the reading, and posts again.
    if (preview.warning && !acknowledgedWarning) {
      return NextResponse.json({
        needsConfirmation: true,
        warning: preview.warning,
        distanceKm: preview.distanceKm,
        distanceLabel: formatKm(preview.distanceKm),
        durationLabel: formatDuration(preview.startedAt, new Date()),
      });
    }

    const trip = await endTrip({
      tripId,
      userId: auth.userId,
      isAdmin,
      endOdo,
      endOdoPhotoUrl,
      // Derived from the rule rather than taken on trust, so `FLAGGED` means
      // what it says: a driver saw a warning and confirmed the reading anyway.
      acknowledgedWarning: preview.warning !== null,
    });

    return NextResponse.json({
      needsConfirmation: false,
      tripId: trip.id,
      distanceKm: trip.distanceKm,
      distanceLabel: formatKm(trip.distanceKm ?? 0),
      durationLabel:
        trip.endedAt && formatDuration(trip.startedAt, trip.endedAt),
      flagged: trip.status === "FLAGGED",
    });
  } catch (error) {
    if (error instanceof TripError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "NOT_YOUR_TRIP" ? 403 : 400 }
      );
    }
    console.error("Mobile end trip error:", error);
    return NextResponse.json(
      { error: "Could not end the trip." },
      { status: 500 }
    );
  }
}

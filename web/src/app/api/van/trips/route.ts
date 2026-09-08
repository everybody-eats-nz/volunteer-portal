import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isApprovedDriver } from "@/lib/van/drivers";
import { checkStartTripRequest, startTripSchema } from "@/lib/van/requests";
import { startTrip, TripError } from "@/lib/van/trips";

/** POST /api/van/trips — open a trip, closing whatever was open on that van. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // The one gate on driving. Never a role check: a volunteer who also drives
  // stays a volunteer, and an outside borrower never becomes an admin.
  if (!(await isApprovedDriver(session.user.id))) {
    return NextResponse.json(
      { error: "Your driver account is not approved yet." },
      { status: 403 }
    );
  }

  const parsed = startTripSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That trip is missing something." },
      { status: 400 }
    );
  }

  // Shared with the app's handler — see lib/van/requests.ts. Two copies of
  // "what makes a startable trip" is how the two flows drift apart.
  const problem = await checkStartTripRequest(parsed.data);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const { trip, closedTripId } = await startTrip({
      ...parsed.data,
      driverId: session.user.id,
    });
    return NextResponse.json({ tripId: trip.id, closedTripId }, { status: 201 });
  } catch (error) {
    if (error instanceof TripError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "RACED" ? 409 : 400 }
      );
    }
    console.error("Start trip error:", error);
    return NextResponse.json(
      { error: "Could not start the trip." },
      { status: 500 }
    );
  }
}

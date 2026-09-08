import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { tripNotesSchema } from "@/lib/van/requests";
import { setTripNotes, TripError } from "@/lib/van/trips";

/**
 * PATCH /api/van/trips/[tripId] — the optional note.
 *
 * Lives after the trip has started rather than in the way of it, so nothing
 * about writing one is on the critical path of getting the van moving.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await params;
  const parsed = tripNotesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid note." }, { status: 400 });
  }

  try {
    await setTripNotes(
      tripId,
      session.user.id,
      session.user.role === "ADMIN",
      parsed.data.notes
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TripError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Trip notes error:", error);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}

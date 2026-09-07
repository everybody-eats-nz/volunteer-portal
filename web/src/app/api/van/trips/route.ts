import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isApprovedDriver } from "@/lib/van/drivers";
import { startTrip, TripError } from "@/lib/van/trips";

const startTripSchema = z.object({
  vehicleId: z.string().min(1),
  startOdo: z.number().int().positive(),
  startOdoPhotoUrl: z.string().nullable(),
  organisationId: z.string().min(1),
  externalOrgName: z.string().trim().min(2).max(120).nullable(),
  purposeId: z.string().nullable(),
  purposeOther: z.string().trim().min(3).max(500).nullable(),
});

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
  const input = parsed.data;

  // An external trip describes its use in free text; an internal one carries a
  // purpose. One or the other has to be there or the report cannot break the
  // trip down at all.
  if (!input.purposeId && !input.purposeOther) {
    return NextResponse.json(
      { error: "Say what the van is doing." },
      { status: 400 }
    );
  }

  const organisation = await prisma.organisation.findUnique({
    where: { id: input.organisationId },
  });
  if (!organisation || !organisation.isActive) {
    return NextResponse.json(
      { error: "That organisation is not on the list." },
      { status: 400 }
    );
  }
  // Only the catch-all row carries a typed-in borrower name.
  if (!organisation.isCatchAll && input.externalOrgName) {
    return NextResponse.json(
      { error: "That organisation does not take a name." },
      { status: 400 }
    );
  }
  if (organisation.isCatchAll && !input.externalOrgName) {
    return NextResponse.json(
      { error: "Say who is borrowing the van." },
      { status: 400 }
    );
  }

  try {
    const { trip, closedTripId } = await startTrip({
      ...input,
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

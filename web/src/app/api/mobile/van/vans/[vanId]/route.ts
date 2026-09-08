import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { firstNameOf, formatOdo, formatSince } from "@/lib/van/format";
import { requireMobileDriver } from "@/lib/van/mobile-guard";
import { getStartOptions } from "@/lib/van/queries";

/**
 * GET /api/mobile/van/vans/[vanId]
 *
 * One van, everything needed to start a trip in it. The Drive tab already has
 * this from `/home`; this exists for the cold start, where the QR sticker's
 * universal link opens the app straight onto a van the tab has never loaded.
 *
 * A van that is already out is not an error here. The next driver photographs
 * the odometer once, and that single observed reading closes the open trip and
 * opens theirs — so the screen needs to know who has it and since when, not to
 * refuse.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ vanId: string }> }
) {
  const auth = await requireMobileDriver(request);
  if (auth.denied) return auth.denied;

  const { vanId } = await params;
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vanId } });
  if (!vehicle || !vehicle.isActive) {
    return NextResponse.json({ error: "That van is not in the list" }, { status: 404 });
  }

  const now = new Date();
  const [openTrip, options] = await Promise.all([
    prisma.trip.findFirst({
      where: { vehicleId: vehicle.id, status: "OPEN" },
      include: {
        driver: { select: { id: true, name: true, firstName: true } },
      },
    }),
    getStartOptions(auth.userId),
  ]);

  return NextResponse.json({
    vehicle: {
      id: vehicle.id,
      name: vehicle.name,
      rego: vehicle.rego,
      homeCity: vehicle.homeCity,
      photoUrl: vehicle.photoUrl,
      currentOdo: vehicle.currentOdo,
      currentOdoLabel: formatOdo(vehicle.currentOdo),
    },
    openTrip: openTrip
      ? {
          id: openTrip.id,
          holderFirstName: firstNameOf(
            openTrip.driver.firstName ?? openTrip.driver.name
          ),
          isMine: openTrip.driverId === auth.userId,
          startedAt: openTrip.startedAt.toISOString(),
          sinceLabel: formatSince(openTrip.startedAt, now),
          startOdo: openTrip.startOdo,
          startOdoLabel: formatOdo(openTrip.startOdo),
        }
      : null,
    options,
  });
}

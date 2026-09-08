import { prisma } from "@/lib/prisma";
import { firstNameOf } from "@/lib/van/format";
import type { TripWithContext } from "@/lib/van/trips";

/** Reads shared by the driver screens and the admin screens. */

/**
 * What a trip is *for*, resolved for display. A borrowed trip names the
 * borrower rather than the catch-all organisation row, and an external trip
 * describes itself in free text where an internal one carries a purpose.
 */
export function orgLabelOf(trip: {
  externalOrgName: string | null;
  organisation: { name: string };
}): string {
  return trip.externalOrgName ?? trip.organisation.name;
}

export function purposeLabelOf(trip: {
  purpose: { label: string } | null;
  purposeOther: string | null;
}): string {
  return trip.purpose?.label ?? trip.purposeOther ?? "Not recorded";
}

export function driverNameOf(trip: {
  driver: { name: string | null; firstName: string | null; lastName: string | null };
}): string {
  const { name, firstName, lastName } = trip.driver;
  if (name) return name;
  const joined = [firstName, lastName].filter(Boolean).join(" ");
  return joined || "Unknown driver";
}

export function toTripScreen(trip: TripWithContext, viewerId: string | null, isAdmin: boolean) {
  return {
    id: trip.id,
    status: trip.status,
    vehicleName: trip.vehicle.name,
    vehicleRego: trip.vehicle.rego,
    driverName: driverNameOf(trip),
    orgLabel: orgLabelOf(trip),
    purposeLabel: purposeLabelOf(trip),
    startedAt: trip.startedAt.toISOString(),
    endedAt: trip.endedAt?.toISOString() ?? null,
    startOdo: trip.startOdo,
    endOdo: trip.endOdo,
    startOdoPhotoUrl: trip.startOdoPhotoUrl,
    endOdoPhotoUrl: trip.endOdoPhotoUrl,
    distanceKm: trip.distanceKm,
    notes: trip.notes,
    canEdit: trip.driverId === viewerId || isAdmin,
  };
}

/** The fleet, with whoever currently has each van out. */
export async function getFleetStatus() {
  const [vehicles, openTrips] = await Promise.all([
    prisma.vehicle.findMany({
      where: { isActive: true },
      orderBy: [{ homeCity: "asc" }, { name: "asc" }],
    }),
    prisma.trip.findMany({
      where: { status: "OPEN" },
      include: {
        driver: { select: { id: true, name: true, firstName: true } },
      },
    }),
  ]);

  return vehicles.map((vehicle) => {
    const open = openTrips.find((t) => t.vehicleId === vehicle.id) ?? null;
    return {
      id: vehicle.id,
      name: vehicle.name,
      rego: vehicle.rego,
      homeCity: vehicle.homeCity,
      currentOdo: vehicle.currentOdo,
      photoUrl: vehicle.photoUrl,
      openTrip: open
        ? {
            id: open.id,
            startedAt: open.startedAt.toISOString(),
            holderFirstName: firstNameOf(open.driver.firstName ?? open.driver.name),
            holderId: open.driverId,
          }
        : null,
    };
  });
}

export type FleetStatus = Awaited<ReturnType<typeof getFleetStatus>>;

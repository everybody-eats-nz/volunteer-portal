import { Prisma } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { hoursBetween, isImplausible } from "@/lib/van/plausibility";

/**
 * Everything that writes a trip goes through this module. The driver flow, the
 * admin screens and (later) the mobile app all call these, so the odometer
 * chain every exception rule reads has exactly one author.
 */

/** A van is out when it has an OPEN trip. There is at most one, by index. */
export const OPEN_TRIP_INDEX = "Trip_one_open_per_vehicle";

export class TripError extends Error {
  constructor(
    message: string,
    readonly code:
      | "VAN_NOT_FOUND"
      | "NOT_APPROVED"
      | "END_BELOW_START"
      | "TRIP_NOT_OPEN"
      | "NOT_YOUR_TRIP"
      | "RACED"
  ) {
    super(message);
    this.name = "TripError";
  }
}

export const tripInclude = {
  vehicle: true,
  driver: {
    select: { id: true, name: true, firstName: true, lastName: true },
  },
  organisation: true,
  purpose: true,
} satisfies Prisma.TripInclude;

export type TripWithContext = Prisma.TripGetPayload<{
  include: typeof tripInclude;
}>;

export interface StartTripInput {
  vehicleId: string;
  driverId: string;
  startOdo: number;
  startOdoPhotoUrl: string | null;
  organisationId: string;
  externalOrgName: string | null;
  purposeId: string | null;
  purposeOther: string | null;
}

export interface StartTripResult {
  trip: TripWithContext;
  /** The trip this reading closed on the way in, if the van was already out. */
  closedTripId: string | null;
}

/**
 * Open a trip, closing whatever was already open on that van with the same
 * reading.
 *
 * The alternative — silently stamping an end reading nobody observed — writes a
 * number into the odometer chain that every exception rule depends on. So the
 * two flows are merged instead: the new driver photographs the dial once, and
 * that single observed reading both closes the trip before it and opens theirs.
 * The closed trip records who closed it and is flagged, so the office sees that
 * its end *time* is when the van went out again rather than when it came back.
 */
export async function startTrip(
  input: StartTripInput
): Promise<StartTripResult> {
  const now = new Date();

  return prisma
    .$transaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({
        where: { id: input.vehicleId },
      });
      if (!vehicle || !vehicle.isActive) {
        throw new TripError("That van is not in the list", "VAN_NOT_FOUND");
      }

      const open = await tx.trip.findFirst({
        where: { vehicleId: input.vehicleId, status: "OPEN" },
      });

      let closedTripId: string | null = null;
      if (open) {
        // The reading may sit below the open trip's start when the previous
        // driver mistyped theirs. Record it anyway rather than refusing to let
        // this driver start: the resulting negative distance surfaces as a
        // high-severity exception, and the office can fix the typo the new
        // driver has no way to see. The hard stop belongs on `endTrip`, where
        // the driver is looking at their own start reading and can correct it.
        await tx.trip.update({
          where: { id: open.id },
          data: {
            endedAt: now,
            endOdo: input.startOdo,
            endOdoPhotoUrl: input.startOdoPhotoUrl,
            distanceKm: input.startOdo - open.startOdo,
            endedByUserId: input.driverId,
            status: "FLAGGED",
          },
        });
        closedTripId = open.id;
      }

      const trip = await tx.trip.create({
        data: {
          vehicleId: input.vehicleId,
          driverId: input.driverId,
          organisationId: input.organisationId,
          externalOrgName: input.externalOrgName,
          purposeId: input.purposeId,
          purposeOther: input.purposeOther,
          startedAt: now,
          startOdo: input.startOdo,
          startOdoPhotoUrl: input.startOdoPhotoUrl,
          status: "OPEN",
        },
        include: tripInclude,
      });

      // GREATEST in the database rather than Math.max here: two drivers can be
      // writing to the same van's cache at once, and a van's odometer cannot
      // go backwards.
      await tx.$executeRaw`
        UPDATE "Vehicle"
        SET "currentOdo" = GREATEST("currentOdo", ${input.startOdo}),
            "updatedAt" = now()
        WHERE id = ${input.vehicleId}
      `;

      return { trip, closedTripId };
    })
    .catch((error) => {
      // Two drivers scanning the same sticker at once. The partial unique index
      // lets exactly one through; the other is told the van is out rather than
      // silently forking the chain.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new TripError(
          "Somebody else just started a trip in this van",
          "RACED"
        );
      }
      throw error;
    });
}

export interface EndTripInput {
  tripId: string;
  /** The person tapping "End trip". Must be the trip's driver, or an admin. */
  userId: string;
  isAdmin: boolean;
  endOdo: number;
  endOdoPhotoUrl: string | null;
  /** The driver was warned the reading looked wrong and confirmed it anyway. */
  acknowledgedWarning: boolean;
}

export async function endTrip(input: EndTripInput): Promise<TripWithContext> {
  const now = new Date();
  const trip = await prisma.trip.findUnique({ where: { id: input.tripId } });

  if (!trip || trip.status !== "OPEN") {
    throw new TripError("This trip is already closed", "TRIP_NOT_OPEN");
  }
  if (trip.driverId !== input.userId && !input.isAdmin) {
    throw new TripError("That is not your trip", "NOT_YOUR_TRIP");
  }
  // The one hard stop. A reading below the one the trip started at cannot be
  // what the dial says, and the driver is looking at both numbers on screen.
  if (input.endOdo <= trip.startOdo) {
    throw new TripError(
      `Has to be more than ${trip.startOdo}, the reading this trip started with`,
      "END_BELOW_START"
    );
  }

  const distanceKm = input.endOdo - trip.startOdo;

  const [updated] = await prisma.$transaction([
    prisma.trip.update({
      where: { id: trip.id },
      data: {
        endedAt: now,
        endOdo: input.endOdo,
        endOdoPhotoUrl: input.endOdoPhotoUrl,
        distanceKm,
        endedByUserId: input.userId,
        status: input.acknowledgedWarning ? "FLAGGED" : "CLOSED",
      },
      include: tripInclude,
    }),
    // GREATEST rather than a plain set, and computed in the database rather
    // than here: a van's odometer physically cannot go backwards, so the cache
    // must not either. An admin closing an old trip retroactively, or two
    // trips closing at once, would otherwise wind the number shown on the
    // sticker's page back past reality.
    prisma.$executeRaw`
      UPDATE "Vehicle"
      SET "currentOdo" = GREATEST("currentOdo", ${input.endOdo}),
          "updatedAt" = now()
      WHERE id = ${trip.vehicleId}
    `,
  ]);

  return updated;
}

/**
 * Would this reading warn the driver? Same rule the admin exception list uses —
 * see `lib/van/plausibility.ts` for why they cannot be allowed to diverge.
 */
export function wouldWarn(
  trip: { startedAt: Date; startOdo: number },
  endOdo: number,
  now: Date
): boolean {
  return isImplausible(endOdo - trip.startOdo, hoursBetween(trip.startedAt, now));
}

export async function setTripNotes(
  tripId: string,
  userId: string,
  isAdmin: boolean,
  notes: string
): Promise<void> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { driverId: true },
  });
  if (!trip) throw new TripError("Trip not found", "TRIP_NOT_OPEN");
  if (trip.driverId !== userId && !isAdmin) {
    throw new TripError("That is not your trip", "NOT_YOUR_TRIP");
  }
  await prisma.trip.update({
    where: { id: tripId },
    data: { notes: notes.trim() || null },
  });
}

/**
 * The organisation and purpose the driver last used, when both are still
 * offerable. Powers the "Same as last time" shortcut that collapses two taps
 * into one — the path most drivers take most days.
 */
export async function lastChoiceFor(driverId: string) {
  const last = await prisma.trip.findFirst({
    where: {
      driverId,
      purposeId: { not: null },
      purpose: { isActive: true },
      organisation: { isActive: true },
    },
    orderBy: { startedAt: "desc" },
    include: { organisation: true, purpose: true },
  });
  if (!last?.purpose) return null;
  // A purpose that demands free text is not a one-tap repeat: the note belongs
  // to the trip it was written for, not the next one.
  if (last.purpose.requiresNote) return null;
  return { organisation: last.organisation, purpose: last.purpose };
}

/** Distance an average trip in this van covers, used to size the photo hint. */
export async function typicalTripDistance(vehicleId: string): Promise<number> {
  const result = await prisma.trip.aggregate({
    where: { vehicleId, distanceKm: { not: null, lt: 200 } },
    _avg: { distanceKm: true },
  });
  return Math.round(result._avg.distanceKm ?? 20);
}

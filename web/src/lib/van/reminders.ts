import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/services/expo-push";
import { formatInNZT } from "@/lib/timezone";
import { detectExceptions, type ExceptionTrip } from "@/lib/van/exceptions";
import { formatSince } from "@/lib/van/format";

/**
 * The nudge to end a forgotten trip.
 *
 * Which trips and whose is not decided here: `left-open` in `exceptions.ts`
 * already answers exactly that question for the office, so the reminder asks
 * the same rule. A driver who gets a push and an office that sees a row are
 * then looking at the same fact, and changing when a trip counts as forgotten
 * is one edit rather than two.
 */

/** One nudge, then not again for half a day. A second push is nagging. */
export const QUIET_HOURS = 12;

/**
 * Nothing goes out overnight. A trip that starts at 9am crosses the
 * fourteen-hour line at 11pm, and a phone buzzing at 11pm about a van does not
 * get the van logged any sooner — it just teaches the driver to mute us.
 */
export const SEND_FROM_HOUR = 7;
export const SEND_UNTIL_HOUR = 21;

/** NZ local hour, because that is where the van and the driver are. */
export function withinSendingHours(now: Date): boolean {
  const hour = Number(formatInNZT(now, "H"));
  return hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
}

export interface ReminderRun {
  /** Trips the left-open rule named. */
  found: number;
  /** Drivers actually pushed to. */
  sent: number;
  skipped: "outside-sending-hours" | null;
}

export async function remindLeftOpenTrips(
  now: Date = new Date()
): Promise<ReminderRun> {
  const openTrips = await prisma.trip.findMany({
    where: { status: "OPEN" },
    include: { vehicle: { select: { id: true, name: true } } },
  });

  if (openTrips.length === 0) return { found: 0, sent: 0, skipped: null };

  // Only open trips go in, so only the open-trip rules can fire; `left-open`
  // is the one we want and the rest are filtered rather than reimplemented.
  const exceptions = detectExceptions(
    openTrips.map(
      (t): ExceptionTrip => ({
        id: t.id,
        vehicleId: t.vehicleId,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        startOdo: t.startOdo,
        endOdo: t.endOdo,
        startOdoPhotoUrl: t.startOdoPhotoUrl,
        endOdoPhotoUrl: t.endOdoPhotoUrl,
        distanceKm: t.distanceKm,
        status: t.status,
        endedByUserId: t.endedByUserId,
        driverId: t.driverId,
      })
    ),
    openTrips.map((t) => ({ id: t.vehicle.id, name: t.vehicle.name })),
    now
  ).filter((e) => e.kind === "left-open");

  if (exceptions.length === 0) return { found: 0, sent: 0, skipped: null };

  // The rule is evaluated regardless of the hour so the count is honest; only
  // the push waits for a civilised time.
  if (!withinSendingHours(now)) {
    return {
      found: exceptions.length,
      sent: 0,
      skipped: "outside-sending-hours",
    };
  }

  const quietBefore = new Date(now.getTime() - QUIET_HOURS * 3_600_000);
  let sent = 0;

  for (const exception of exceptions) {
    const trip = openTrips.find((t) => t.id === exception.tripId);
    if (!trip) continue;
    if (trip.reminderSentAt && trip.reminderSentAt > quietBefore) continue;

    await sendPushToUser(trip.driverId, {
      title: `${trip.vehicle.name} is still logged out`,
      body: `Your trip has been open ${formatSince(
        trip.startedAt,
        now
      )}. Tap to photograph the odometer and close it.`,
      data: { actionUrl: `/drive/trip/${trip.id}` },
    });

    // Stamped whether or not a device was reachable. A driver with no
    // registered phone cannot be nudged, and retrying every hour forever only
    // costs Expo requests.
    await prisma.trip.update({
      where: { id: trip.id },
      data: { reminderSentAt: now },
    });
    sent += 1;
  }

  return { found: exceptions.length, sent, skipped: null };
}

import {
  formatDay,
  formatDuration,
  formatKm,
  formatOdo,
  formatSince,
  formatTime,
} from "@/lib/van/format";
import { driverNameOf, orgLabelOf, purposeLabelOf } from "@/lib/van/queries";
import type { TripWithContext } from "@/lib/van/trips";

/**
 * The shapes `/api/mobile/van/*` hands the app.
 *
 * Every human-readable label is built here rather than on the device. A phone
 * carried overseas, or one whose clock is set to another zone, would otherwise
 * put a Wellington trip on the wrong day — the same class of bug that put the
 * portal's calendar a day out. `format.ts` is the app's single timezone
 * implementation, so the labels come from it and the raw values ride along for
 * anything the app genuinely needs to compute.
 */

export interface MobileTripSummary {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleRego: string;
  purposeLabel: string;
  orgLabel: string;
  /** The line under the purpose on the driver's history. */
  subtitle: string;
  startedAt: string;
  startedAtLabel: string;
  dayLabel: string;
  endedAt: string | null;
  distanceKm: number | null;
  distanceLabel: string;
  durationLabel: string | null;
  status: "OPEN" | "CLOSED" | "FLAGGED";
  flagged: boolean;
}

export function toTripSummary(trip: TripWithContext): MobileTripSummary {
  return {
    id: trip.id,
    vehicleId: trip.vehicleId,
    vehicleName: trip.vehicle.name,
    vehicleRego: trip.vehicle.rego,
    purposeLabel: purposeLabelOf(trip),
    orgLabel: orgLabelOf(trip),
    subtitle: trip.organisation.isInternal
      ? `${trip.vehicle.name} · ${formatTime(trip.startedAt)}`
      : `${trip.vehicle.name} · ${orgLabelOf(trip)}`,
    startedAt: trip.startedAt.toISOString(),
    startedAtLabel: formatTime(trip.startedAt),
    dayLabel: formatDay(trip.startedAt),
    endedAt: trip.endedAt?.toISOString() ?? null,
    distanceKm: trip.distanceKm,
    distanceLabel: formatKm(trip.distanceKm ?? 0),
    durationLabel: trip.endedAt
      ? formatDuration(trip.startedAt, trip.endedAt)
      : null,
    status: trip.status,
    flagged: trip.status === "FLAGGED",
  };
}

export interface MobileOpenTrip extends MobileTripSummary {
  startOdo: number;
  startOdoLabel: string;
  startOdoPhotoUrl: string | null;
  /** "since 6:12am", or "since Wed 3 Sep, 2:40pm" when it was another day. */
  sinceLabel: string;
}

export function toOpenTrip(
  trip: TripWithContext,
  now: Date
): MobileOpenTrip {
  return {
    ...toTripSummary(trip),
    startOdo: trip.startOdo,
    startOdoLabel: formatOdo(trip.startOdo),
    startOdoPhotoUrl: trip.startOdoPhotoUrl,
    sinceLabel: formatSince(trip.startedAt, now),
  };
}

export interface MobileTripDetail extends MobileOpenTrip {
  endOdo: number | null;
  endOdoLabel: string | null;
  endOdoPhotoUrl: string | null;
  endedAtLabel: string | null;
  notes: string | null;
  driverName: string;
  /** False on a trip the next driver closed — the reading is not this one's. */
  isMine: boolean;
}

export function toTripDetail(
  trip: TripWithContext,
  viewerId: string,
  now: Date
): MobileTripDetail {
  return {
    ...toOpenTrip(trip, now),
    endOdo: trip.endOdo,
    endOdoLabel: trip.endOdo == null ? null : formatOdo(trip.endOdo),
    endOdoPhotoUrl: trip.endOdoPhotoUrl,
    endedAtLabel: trip.endedAt ? formatTime(trip.endedAt) : null,
    notes: trip.notes,
    driverName: driverNameOf(trip),
    isMine: trip.driverId === viewerId,
  };
}

/**
 * The driver's history, grouped by NZ day. Grouped on the server for the same
 * reason the labels are formatted here: a day boundary is a question about
 * Pacific/Auckland, not about the phone.
 */
export function groupTripsByDay(trips: MobileTripSummary[]) {
  const days: { key: string; label: string; trips: MobileTripSummary[] }[] = [];
  for (const trip of trips) {
    const existing = days.find((d) => d.key === trip.dayLabel);
    if (existing) existing.trips.push(trip);
    else days.push({ key: trip.dayLabel, label: trip.dayLabel, trips: [trip] });
  }
  return days;
}

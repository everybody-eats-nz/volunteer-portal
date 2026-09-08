import {
  explainImplausible,
  hoursBetween,
  isImplausible,
} from "@/lib/van/plausibility";
import { formatDuration, formatKm, formatOdo } from "@/lib/van/format";

/**
 * Exceptions are derived at read time, never stored. Fix the underlying trip and
 * the exception disappears on its own, so this view cannot go stale the way a
 * table of resolved flags would.
 *
 * `TripStatus.FLAGGED` means something narrower: a driver saw a warning and
 * confirmed the reading anyway, or the next driver closed the trip. That is a
 * fact about what happened, so it is stored; whether the record still looks
 * wrong is a question about the current data, so it is not.
 */

export type ExceptionKind =
  | "odo-gap"
  | "odo-overlap"
  | "missing-photo"
  | "implausible-distance"
  | "left-open"
  | "closed-by-next-driver";

export type Severity = "high" | "medium";

export interface TripException {
  id: string;
  kind: ExceptionKind;
  severity: Severity;
  tripId: string;
  vehicleId: string;
  /** The earlier trip, where one is implicated. */
  relatedTripId: string | null;
  title: string;
  detail: string;
  occurredAt: Date;
}

/** The minimum a trip has to expose to be checked. */
export interface ExceptionTrip {
  id: string;
  vehicleId: string;
  startedAt: Date;
  endedAt: Date | null;
  startOdo: number;
  endOdo: number | null;
  startOdoPhotoUrl: string | null;
  endOdoPhotoUrl: string | null;
  distanceKm: number | null;
  status: "OPEN" | "CLOSED" | "FLAGGED";
  endedByUserId: string | null;
  driverId: string;
}

export interface ExceptionVehicle {
  id: string;
  name: string;
}

export const EXCEPTION_LABELS: Record<ExceptionKind, string> = {
  "odo-gap": "Unlogged driving",
  "odo-overlap": "Reading goes backwards",
  "missing-photo": "Missing odometer photo",
  "implausible-distance": "Implausible distance",
  "left-open": "Trip left open",
  "closed-by-next-driver": "Closed by the next driver",
};

export const EXCEPTION_BLURBS: Record<ExceptionKind, string> = {
  "odo-gap":
    "The van moved between two logged trips. Someone drove without opening a trip.",
  "odo-overlap":
    "A trip starts below where the previous one ended, so one of the two readings is wrong.",
  "missing-photo": "No photo backs up the reading that was recorded.",
  "implausible-distance":
    "The distance or the implied speed is outside what this van could plausibly do.",
  "left-open":
    "A trip was started and never ended, so the van still reads as out.",
  "closed-by-next-driver":
    "The driver never ended their trip. The next person to take the van closed it with the reading they photographed, so the end time is when the van went out again, not when it came back.",
};

const MAX_OPEN_HOURS = 14;

export function detectExceptions(
  trips: ExceptionTrip[],
  vehicles: ExceptionVehicle[],
  now: Date
): TripException[] {
  const found: TripException[] = [];
  const nameOf = (id: string) =>
    vehicles.find((v) => v.id === id)?.name ?? "This van";

  // Odometer chain, per vehicle, in the order the trips were driven.
  for (const vehicle of vehicles) {
    const chain = trips
      .filter((t) => t.vehicleId === vehicle.id)
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

    let previous: ExceptionTrip | null = null;
    for (const trip of chain) {
      if (previous?.endOdo != null) {
        const delta = trip.startOdo - previous.endOdo;
        if (delta > 0) {
          found.push({
            id: `${trip.id}:odo-gap`,
            kind: "odo-gap",
            severity: delta >= 20 ? "high" : "medium",
            tripId: trip.id,
            vehicleId: vehicle.id,
            relatedTripId: previous.id,
            title: `${nameOf(vehicle.id)} · ${formatKm(delta)} unaccounted for`,
            detail: `Previous trip ended at ${formatOdo(
              previous.endOdo
            )} and this one started at ${formatOdo(trip.startOdo)}.`,
            occurredAt: trip.startedAt,
          });
        } else if (delta < 0) {
          found.push({
            id: `${trip.id}:odo-overlap`,
            kind: "odo-overlap",
            severity: "high",
            tripId: trip.id,
            vehicleId: vehicle.id,
            relatedTripId: previous.id,
            title: `${nameOf(vehicle.id)} · reading drops ${formatKm(
              Math.abs(delta)
            )}`,
            detail: `This trip starts at ${formatOdo(
              trip.startOdo
            )}, below the ${formatOdo(
              previous.endOdo
            )} recorded at the end of the previous trip. One of the two readings is wrong.`,
            occurredAt: trip.startedAt,
          });
        }
      }
      if (trip.endOdo != null) previous = trip;
    }
  }

  for (const trip of trips) {
    // Photos.
    const missing: string[] = [];
    if (!trip.startOdoPhotoUrl) missing.push("start");
    if (trip.status !== "OPEN" && !trip.endOdoPhotoUrl) missing.push("end");
    if (missing.length > 0) {
      found.push({
        id: `${trip.id}:missing-photo`,
        kind: "missing-photo",
        severity: "medium",
        tripId: trip.id,
        vehicleId: trip.vehicleId,
        relatedTripId: null,
        title: `${nameOf(trip.vehicleId)} · no ${missing.join(" or ")} photo`,
        detail: `The ${missing.join(
          " and "
        )} reading was recorded without a photo to back it up.`,
        occurredAt: trip.startedAt,
      });
    }

    // Distance and implied speed.
    if (trip.distanceKm != null && trip.endedAt) {
      const hours = hoursBetween(trip.startedAt, trip.endedAt);
      if (trip.distanceKm <= 0) {
        found.push({
          id: `${trip.id}:implausible-distance`,
          kind: "implausible-distance",
          severity: "high",
          tripId: trip.id,
          vehicleId: trip.vehicleId,
          relatedTripId: null,
          title: `${nameOf(trip.vehicleId)} · recorded ${formatKm(
            trip.distanceKm
          )}`,
          detail: "The end reading is not above the start reading.",
          occurredAt: trip.startedAt,
        });
      } else if (isImplausible(trip.distanceKm, hours)) {
        found.push({
          id: `${trip.id}:implausible-distance`,
          kind: "implausible-distance",
          severity: "high",
          tripId: trip.id,
          vehicleId: trip.vehicleId,
          relatedTripId: null,
          title: `${nameOf(trip.vehicleId)} · ${formatKm(
            trip.distanceKm
          )} in ${formatDuration(trip.startedAt, trip.endedAt)}`,
          detail: explainImplausible(trip.distanceKm, hours),
          occurredAt: trip.startedAt,
        });
      }
    }

    // Closed by whoever took the van next, rather than by its own driver. The
    // reading itself is sound — the next driver photographed it — but the end
    // time is when the van went out again, so anything derived from duration
    // is only an upper bound.
    if (trip.endedByUserId && trip.endedByUserId !== trip.driverId) {
      found.push({
        id: `${trip.id}:closed-by-next-driver`,
        kind: "closed-by-next-driver",
        severity: "medium",
        tripId: trip.id,
        vehicleId: trip.vehicleId,
        relatedTripId: null,
        title: `${nameOf(trip.vehicleId)} · ended by the next driver`,
        detail:
          "The driver did not end this trip. The reading came from the next person to take the van, so the end time is when the van left again.",
        occurredAt: trip.startedAt,
      });
    }

    // Still open.
    if (trip.status === "OPEN") {
      const hours = hoursBetween(trip.startedAt, now);
      const startedYesterdayOrEarlier =
        trip.startedAt.toDateString() !== now.toDateString();
      if (hours > MAX_OPEN_HOURS || startedYesterdayOrEarlier) {
        found.push({
          id: `${trip.id}:left-open`,
          kind: "left-open",
          severity: hours > 24 ? "high" : "medium",
          tripId: trip.id,
          vehicleId: trip.vehicleId,
          relatedTripId: null,
          title: `${nameOf(trip.vehicleId)} · open for ${
            hours >= 24
              ? `${Math.floor(hours / 24)} days`
              : `${Math.round(hours)} hours`
          }`,
          detail:
            "The van still reads as out, so nobody else can log a trip in it and its odometer is stale.",
          occurredAt: trip.startedAt,
        });
      }
    }
  }

  return found.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    return b.occurredAt.getTime() - a.occurredAt.getTime();
  });
}

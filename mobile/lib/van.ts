import { api, apiUpload } from "./api";

/**
 * The Drive tab's half of the van mileage log.
 *
 * Everything here is a thin call onto `/api/mobile/van/*`, which wraps the
 * same `lib/van/` functions the web driver flow uses. Two rules in particular
 * are deliberately *not* implemented on this side:
 *
 * - Whether a reading looks implausible. That lives in the web app's
 *   `plausibility.ts`, shared by the driver's warning and the office's
 *   exception list. `endTrip` below asks the server and gets the warning back;
 *   retyping the thresholds here is exactly the drift that module prevents.
 * - What a day is, and how a date reads. Labels arrive pre-formatted in NZ
 *   time, so a phone whose clock is set overseas cannot file a Wellington trip
 *   under the wrong day.
 */

export type DriverStatus = "PENDING" | "APPROVED" | "SUSPENDED";
export type TripStatus = "OPEN" | "CLOSED" | "FLAGGED";

export type DriverState = {
  status: DriverStatus | null;
  statusNote: string | null;
  canDrive: boolean;
};

export type TripSummary = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  vehicleRego: string;
  purposeLabel: string;
  orgLabel: string;
  subtitle: string;
  startedAt: string;
  startedAtLabel: string;
  dayLabel: string;
  endedAt: string | null;
  distanceKm: number | null;
  distanceLabel: string;
  durationLabel: string | null;
  status: TripStatus;
  flagged: boolean;
};

export type OpenTrip = TripSummary & {
  startOdo: number;
  startOdoLabel: string;
  startOdoPhotoUrl: string | null;
  sinceLabel: string;
};

export type TripDetail = OpenTrip & {
  endOdo: number | null;
  endOdoLabel: string | null;
  endOdoPhotoUrl: string | null;
  endedAtLabel: string | null;
  notes: string | null;
  driverName: string;
  isMine: boolean;
};

export type TripDay = { key: string; label: string; trips: TripSummary[] };

export type VanOrganisation = {
  id: string;
  name: string;
  isInternal: boolean;
  isCatchAll: boolean;
};

export type VanPurpose = { id: string; label: string; requiresNote: boolean };

export type StartShortcut = {
  organisationId: string;
  organisationName: string;
  purposeId: string;
  purposeLabel: string;
};

export type StartOptions = {
  organisations: VanOrganisation[];
  purposes: VanPurpose[];
  shortcut: StartShortcut | null;
};

export type FleetVan = {
  id: string;
  name: string;
  rego: string;
  homeCity: string;
  currentOdo: number;
  currentOdoLabel: string;
  photoUrl: string | null;
  isMine: boolean;
  openTrip: {
    id: string;
    startedAt: string;
    holderFirstName: string;
    holderId: string;
  } | null;
};

export type DriveHome = {
  firstName: string;
  todayLabel: string;
  recentKm: number;
  recentKmLabel: string;
  openTrip: OpenTrip | null;
  fleet: FleetVan[];
  days: TripDay[];
  options: StartOptions;
};

export type VanScreen = {
  vehicle: {
    id: string;
    name: string;
    rego: string;
    homeCity: string;
    photoUrl: string | null;
    currentOdo: number;
    currentOdoLabel: string;
  };
  openTrip: {
    id: string;
    holderFirstName: string;
    isMine: boolean;
    startedAt: string;
    sinceLabel: string;
    startOdo: number;
    startOdoLabel: string;
  } | null;
  options: StartOptions;
};

export const fetchDriverState = () => api<DriverState>("/api/mobile/van/driver");

export const fetchDriveHome = () => api<DriveHome>("/api/mobile/van/home");

export const fetchVan = (vanId: string) =>
  api<VanScreen>(`/api/mobile/van/vans/${vanId}`);

export const fetchTrip = (tripId: string) =>
  api<{ trip: TripDetail }>(`/api/mobile/van/trips/${tripId}`).then((r) => r.trip);

export const fetchTripHistory = (cursor?: string | null) =>
  api<{
    days: TripDay[];
    pageKm: number;
    pageKmLabel: string;
    nextCursor: string | null;
  }>(`/api/mobile/van/trips${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);

export type StartTripInput = {
  vehicleId: string;
  startOdo: number;
  startOdoPhotoUrl: string | null;
  organisationId: string;
  externalOrgName: string | null;
  purposeId: string | null;
  purposeOther: string | null;
};

export const startTrip = (input: StartTripInput) =>
  api<{ tripId: string; closedTripId: string | null }>("/api/mobile/van/trips", {
    method: "POST",
    body: input,
  });

/**
 * Ending a trip is two-phase only when the reading looks wrong.
 *
 * The first post carries `acknowledgedWarning: false`. If the server's
 * plausibility rule fires, nothing is written and the warning comes back for
 * the driver to read; posting again with `true` records the trip and flags it.
 * An ordinary reading closes on the first post, so the common path is still
 * one round trip.
 */
export type EndTripResult =
  | {
      needsConfirmation: true;
      warning: string;
      distanceKm: number;
      distanceLabel: string;
      durationLabel: string;
    }
  | {
      needsConfirmation: false;
      tripId: string;
      distanceKm: number | null;
      distanceLabel: string;
      durationLabel: string | null;
      flagged: boolean;
    };

export const endTrip = (
  tripId: string,
  input: {
    endOdo: number;
    endOdoPhotoUrl: string | null;
    acknowledgedWarning: boolean;
  }
) =>
  api<EndTripResult>(`/api/mobile/van/trips/${tripId}/end`, {
    method: "POST",
    body: input,
  });

export const setTripNotes = (tripId: string, notes: string) =>
  api<{ ok: true }>(`/api/mobile/van/trips/${tripId}`, {
    method: "PATCH",
    body: { notes },
  });

/**
 * Upload one odometer photo, returning its URL — or null if it would not go.
 *
 * Never throws. A driver stopped in a loading bay by an upload error is a
 * driver who goes back to the paper book, so a photo that will not store is
 * simply absent: the reading is still recorded and the trip lands on the
 * office's missing-photo exception, which is exactly where it belongs.
 */
export async function uploadOdometerPhoto(asset: {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<string | null> {
  const mimeType = asset.mimeType ?? "image/jpeg";
  const formData = new FormData();
  formData.append("photo", {
    uri: asset.uri,
    name: asset.fileName ?? `odometer.${mimeType.split("/")[1] ?? "jpg"}`,
    type: mimeType,
  } as unknown as Blob);

  try {
    const { url } = await apiUpload<{ url: string }>(
      "/api/mobile/van/photos",
      formData
    );
    return url;
  } catch {
    return null;
  }
}

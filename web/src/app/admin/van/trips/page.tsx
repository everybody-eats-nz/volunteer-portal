import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { tripInclude } from "@/lib/van/trips";
import { driverNameOf, orgLabelOf, purposeLabelOf } from "@/lib/van/queries";
import {
  detectExceptions,
  EXCEPTION_LABELS,
  type TripException,
} from "@/lib/van/exceptions";
import {
  dayKey,
  formatDate,
  formatDay,
  formatDuration,
  formatKm,
  formatTime,
} from "@/lib/van/format";
import { monthOf } from "@/lib/van/period";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { VanTripsContent, type AdminTripRow } from "./trips-content";

/**
 * The trips ledger.
 *
 * Everybody Eats owes Meridian a monthly breakdown of how the vans are used,
 * and this screen is where that breakdown is read, checked and exported. So it
 * is organised by reporting period rather than as one long descending list, and
 * it carries the audit inline: the odometer chain and the derived exceptions
 * sit on the row they belong to, not only on a separate page.
 *
 * The exceptions are the *same* `detectExceptions` the exceptions view runs.
 * Recomputing the rules here would let the two screens drift, and a ledger that
 * disagrees with the audit is worse than one that shows nothing.
 */

/**
 * The ledger reads a window over the recent record rather than the whole of it,
 * the same window the exceptions view takes. That is fine for a list and not
 * fine for a total: the oldest month inside a full window is only partly
 * loaded, so totalling it would under-report the month to the funder. The
 * client is told when the window filled up and drops that month.
 */
const TRIP_WINDOW = 1500;

export default async function VanTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicle?: string }>;
}) {
  const [{ vehicle }, session] = await Promise.all([
    searchParams,
    getServerSession(authOptions),
  ]);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [trips, vehicles, purposes] = await Promise.all([
    prisma.trip.findMany({
      include: tripInclude,
      orderBy: { startedAt: "desc" },
      take: TRIP_WINDOW,
    }),
    prisma.vehicle.findMany({ orderBy: { name: "asc" } }),
    prisma.tripPurpose.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const flagsByTrip = new Map<string, TripException[]>();
  for (const exception of detectExceptions(trips, vehicles, new Date())) {
    const list = flagsByTrip.get(exception.tripId);
    if (list) list.push(exception);
    else flagsByTrip.set(exception.tripId, [exception]);
  }

  // Where the previous trip in this van left the dial. The ledger renders the
  // chain against it, so a gap or a reading that goes backwards is visible on
  // the row itself rather than only in a total that quietly does not add up.
  //
  // The sort is doing real work, not restating the query: trips arrive newest
  // first, and the chain has to be walked in the order the van was driven.
  const previousEndOdo = new Map<string, number | null>();
  for (const van of vehicles) {
    let previous: number | null = null;
    const chain = trips
      .filter((t) => t.vehicleId === van.id)
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    for (const trip of chain) {
      previousEndOdo.set(trip.id, previous);
      if (trip.endOdo !== null) previous = trip.endOdo;
    }
  }

  const rows: AdminTripRow[] = trips.map((trip) => ({
    id: trip.id,
    date: formatDate(trip.startedAt),
    dayLabel: formatDay(trip.startedAt),
    time: formatTime(trip.startedAt),
    endTime: trip.endedAt ? formatTime(trip.endedAt) : null,
    dayKey: dayKey(trip.startedAt),
    monthKey: monthOf(dayKey(trip.startedAt)),
    durationLabel: trip.endedAt
      ? formatDuration(trip.startedAt, trip.endedAt)
      : null,
    vehicleId: trip.vehicleId,
    vehicleName: trip.vehicle.name,
    vehicleRego: trip.vehicle.rego,
    driverId: trip.driverId,
    driverName: driverNameOf(trip),
    organisationId: trip.organisationId,
    orgLabel: orgLabelOf(trip),
    purposeId: trip.purposeId,
    purposeLabel: purposeLabelOf(trip),
    startOdo: trip.startOdo,
    endOdo: trip.endOdo,
    previousEndOdo: previousEndOdo.get(trip.id) ?? null,
    distanceKm: trip.distanceKm,
    distanceLabel: trip.distanceKm !== null ? formatKm(trip.distanceKm) : "–",
    startOdoPhotoUrl: trip.startOdoPhotoUrl,
    endOdoPhotoUrl: trip.endOdoPhotoUrl,
    status: trip.status,
    notes: trip.notes,
    flags: (flagsByTrip.get(trip.id) ?? []).map((exception) => ({
      kind: exception.kind,
      label: EXCEPTION_LABELS[exception.kind],
      severity: exception.severity,
      detail: exception.detail,
    })),
  }));

  // Drivers offered as a filter are the ones who have actually driven, so the
  // list stays short and every option returns something.
  const drivers = [...new Map(rows.map((r) => [r.driverId, r.driverName])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminPageWrapper
      title="Van trips"
      description="The mileage ledger behind the monthly report, with the odometer photo behind every reading."
    >
      <PageContainer>
        <VanTripsContent
          rows={rows}
          initialVehicleId={vehicle ?? null}
          windowed={trips.length === TRIP_WINDOW}
          options={{
            vehicles: vehicles.map((v) => ({
              id: v.id,
              name: v.name,
              rego: v.rego,
            })),
            drivers,
            purposes: purposes.map((p) => ({
              id: p.id,
              label: p.label,
              isActive: p.isActive,
            })),
            orgLabels: [...new Set(rows.map((r) => r.orgLabel))].sort(),
          }}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

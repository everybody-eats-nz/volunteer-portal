import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { tripInclude } from "@/lib/van/trips";
import { driverNameOf, orgLabelOf, purposeLabelOf } from "@/lib/van/queries";
import { dayKey, formatDate, formatKm, formatTime } from "@/lib/van/format";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { VanTripsContent, type AdminTripRow } from "./trips-content";

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
      take: 1500,
    }),
    prisma.vehicle.findMany({ orderBy: { name: "asc" } }),
    prisma.tripPurpose.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const rows: AdminTripRow[] = trips.map((trip) => ({
    id: trip.id,
    date: formatDate(trip.startedAt),
    time: formatTime(trip.startedAt),
    endTime: trip.endedAt ? formatTime(trip.endedAt) : null,
    dayKey: dayKey(trip.startedAt),
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
    distanceKm: trip.distanceKm,
    distanceLabel: trip.distanceKm !== null ? formatKm(trip.distanceKm) : "–",
    startOdoPhotoUrl: trip.startOdoPhotoUrl,
    endOdoPhotoUrl: trip.endOdoPhotoUrl,
    status: trip.status,
    notes: trip.notes,
  }));

  // Drivers offered as a filter are the ones who have actually driven, so the
  // list stays short and every option returns something.
  const drivers = [...new Map(rows.map((r) => [r.driverId, r.driverName])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminPageWrapper
      title="Van trips"
      description="Every trip logged in the vans, with the odometer photo behind each reading."
    >
      <PageContainer>
        <VanTripsContent
          rows={rows}
          initialVehicleId={vehicle ?? null}
          options={{
            vehicles: vehicles.map((v) => ({ id: v.id, name: v.name })),
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

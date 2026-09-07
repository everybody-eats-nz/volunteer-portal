import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/utils";
import { detectExceptions } from "@/lib/van/exceptions";
import { tripInclude } from "@/lib/van/trips";
import { driverNameOf } from "@/lib/van/queries";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { VanVehiclesContent, type AdminVehicle } from "./vehicles-content";

export default async function VanVehiclesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [vehicles, organisations, trips, totals] = await Promise.all([
    prisma.vehicle.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.organisation.findMany({
      where: { isActive: true, isCatchAll: false },
      orderBy: [{ isInternal: "desc" }, { name: "asc" }],
    }),
    prisma.trip.findMany({
      include: tripInclude,
      orderBy: { startedAt: "desc" },
      take: 1500,
    }),
    prisma.trip.groupBy({
      by: ["vehicleId"],
      _count: { _all: true },
      _sum: { distanceKm: true },
    }),
  ]);

  // The same rule the exceptions page uses, so a van cannot read "Out" here and
  // "Overdue" one tab away.
  const overdueTripIds = new Set(
    detectExceptions(
      trips,
      vehicles.map((v) => ({ id: v.id, name: v.name })),
      new Date()
    )
      .filter((e) => e.kind === "left-open")
      .map((e) => e.tripId)
  );

  const totalsByVehicle = new Map(
    totals.map((row) => [
      row.vehicleId,
      { trips: row._count._all, km: row._sum.distanceKm ?? 0 },
    ])
  );

  const rows: AdminVehicle[] = vehicles.map((vehicle) => {
    const open = trips.find(
      (t) => t.vehicleId === vehicle.id && t.status === "OPEN"
    );
    const totals = totalsByVehicle.get(vehicle.id);
    return {
      id: vehicle.id,
      name: vehicle.name,
      rego: vehicle.rego,
      homeCity: vehicle.homeCity,
      photoUrl: vehicle.photoUrl,
      currentOdo: vehicle.currentOdo,
      isActive: vehicle.isActive,
      ownerOrgId: vehicle.ownerOrgId,
      ownerOrgName:
        organisations.find((o) => o.id === vehicle.ownerOrgId)?.name ??
        "Unknown",
      tripCount: totals?.trips ?? 0,
      loggedKm: totals?.km ?? 0,
      status: !open ? "in" : overdueTripIds.has(open.id) ? "overdue" : "out",
      holderName: open ? driverNameOf(open) : null,
    };
  });

  return (
    <AdminPageWrapper
      title="Vans"
      description="Each van carries a sticker that opens the log with the van already chosen. Print one from here."
    >
      <PageContainer>
        <VanVehiclesContent
          vehicles={rows}
          organisations={organisations.map((o) => ({ id: o.id, name: o.name }))}
          stickerBaseUrl={getBaseUrl()}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

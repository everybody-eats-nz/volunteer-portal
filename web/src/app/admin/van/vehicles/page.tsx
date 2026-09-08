import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/utils";
import { detectExceptions } from "@/lib/van/exceptions";
import { tripInclude } from "@/lib/van/trips";
import { driverNameOf } from "@/lib/van/queries";
import { formatDate, formatSince } from "@/lib/van/format";
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
  const now = new Date();
  const overdueTripIds = new Set(
    detectExceptions(
      trips,
      vehicles.map((v) => ({ id: v.id, name: v.name })),
      now
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
    const forVehicle = trips.filter((t) => t.vehicleId === vehicle.id);
    const open = forVehicle.find((t) => t.status === "OPEN");
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
      status: !vehicle.isActive
        ? "retired"
        : !open
          ? "in"
          : overdueTripIds.has(open.id)
            ? "overdue"
            : "out",
      holderName: open ? driverNameOf(open) : null,
      // Formatted here rather than in the browser: these read in NZ time, and a
      // client that formatted them against its own clock would render a
      // different string on the server than on hydration.
      outSinceLabel: open ? formatSince(open.startedAt, now) : null,
      lastUsedLabel: forVehicle[0] ? formatDate(forVehicle[0].startedAt) : null,
    };
  });

  return (
    <AdminPageWrapper
      title="Vans"
      description="Every van in the fleet, where it is right now, and the sticker that opens its log."
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

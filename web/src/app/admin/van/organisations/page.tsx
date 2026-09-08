import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { VanOrganisationsContent } from "./organisations-content";

/**
 * Who a van can belong to, and who a driver can drive for.
 *
 * This list feeds the "Belongs to" picker on the fleet page and the driver's
 * own registration, so an empty one is a dead end rather than an inconvenience
 * — which is why this is a screen and not a seed script.
 */
export default async function VanOrganisationsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [organisations, vehicles, trips, drivers] = await Promise.all([
    prisma.organisation.findMany({
      orderBy: [{ isInternal: "desc" }, { name: "asc" }],
    }),
    prisma.vehicle.groupBy({ by: ["ownerOrgId"], _count: { _all: true } }),
    prisma.trip.groupBy({ by: ["organisationId"], _count: { _all: true } }),
    prisma.driverProfile.groupBy({
      by: ["organisationId"],
      _count: { _all: true },
    }),
  ]);

  const vansBy = new Map(vehicles.map((r) => [r.ownerOrgId, r._count._all]));
  const tripsBy = new Map(trips.map((r) => [r.organisationId, r._count._all]));
  const driversBy = new Map(
    drivers
      .filter((r) => r.organisationId !== null)
      .map((r) => [r.organisationId!, r._count._all])
  );

  return (
    <AdminPageWrapper
      title="Organisations"
      description="Who a van can belong to, and who a volunteer drives for. Retiring one hides it from every picker without touching the trips already logged against it."
    >
      <PageContainer>
        <VanOrganisationsContent
          initial={organisations.map((org) => ({
            id: org.id,
            name: org.name,
            isInternal: org.isInternal,
            isCatchAll: org.isCatchAll,
            isActive: org.isActive,
            vanCount: vansBy.get(org.id) ?? 0,
            tripCount: tripsBy.get(org.id) ?? 0,
            driverCount: driversBy.get(org.id) ?? 0,
          }))}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

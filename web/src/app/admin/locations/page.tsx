import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { LocationSettingsForm } from "@/components/location-settings-form";

export default async function LocationsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Fetch all locations (both active and inactive)
  const [allLocations, upcomingShiftGroups] = await Promise.all([
    prisma.location.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.shift.groupBy({
      by: ["location"],
      where: { start: { gte: new Date() }, location: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const upcomingCountByLocation = new Map(
    upcomingShiftGroups.map((group) => [group.location, group._count._all])
  );

  // Serialize Decimal targetPerNight to a plain number for the client component
  const serialized = allLocations.map((loc) => ({
    ...loc,
    targetPerNight:
      loc.targetPerNight === null ? null : Number(loc.targetPerNight),
    // Locations without upcoming shifts are hidden from volunteer-facing
    // location lists - surface that so admins know why after creating one.
    hasUpcomingShifts: (upcomingCountByLocation.get(loc.name) ?? 0) > 0,
  }));

  const activeLocations = serialized.filter((loc) => loc.isActive);
  const inactiveLocations = serialized.filter((loc) => !loc.isActive);

  return (
    <AdminPageWrapper
      title="Restaurant Locations"
      description="Manage restaurant location settings including default meals served"
    >
      <PageContainer>
        <div className="space-y-6">
          <LocationSettingsForm
            activeLocations={activeLocations}
            inactiveLocations={inactiveLocations}
          />
        </div>
      </PageContainer>
    </AdminPageWrapper>
  );
}

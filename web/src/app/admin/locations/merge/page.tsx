import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { LocationMergeForm } from "@/components/location-merge-form";
import { Button } from "@/components/ui/button";

export default async function MergeLocationsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Orphaned shift venues (no Location row) can also need merging, so the
  // source list includes any distinct shift location alongside Location rows.
  const [locations, shiftLocations] = await Promise.all([
    prisma.location.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.shift.findMany({
      where: { location: { not: null } },
      select: { location: true },
      distinct: ["location"],
    }),
  ]);

  const knownNames = new Set(locations.map((loc) => loc.name));
  const orphanNames = shiftLocations
    .map((s) => s.location)
    .filter((name): name is string => name !== null && !knownNames.has(name))
    .sort();

  return (
    <AdminPageWrapper
      title="Merge Locations"
      description="Fold a duplicate location into the real one - shifts, templates and settings move across, then the duplicate is removed"
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/locations">← Back to locations</Link>
        </Button>
      }
    >
      <PageContainer testid="admin-merge-locations-page">
        <LocationMergeForm locations={locations} orphanNames={orphanNames} />
      </PageContainer>
    </AdminPageWrapper>
  );
}

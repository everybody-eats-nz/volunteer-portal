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

  // Fetch all locations
  const locations = await prisma.location.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <AdminPageWrapper
      title="Restaurant Locations"
      description="Manage restaurant location settings including default meals served"
    >
      <PageContainer>
        <div className="space-y-6">
          <LocationSettingsForm locations={locations} />
        </div>
      </PageContainer>
    </AdminPageWrapper>
  );
}

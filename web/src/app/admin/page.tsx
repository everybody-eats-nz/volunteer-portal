import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { LocationFilterTabs } from "@/components/location-filter-tabs";
import { LOCATIONS, LocationOption } from "@/lib/locations";
import { AdminDashboardContent } from "./admin-dashboard-content";
import { AdminDashboardContentSkeleton } from "./loading";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;

  // Normalize and validate selected location
  const rawLocation = Array.isArray(params.location)
    ? params.location[0]
    : params.location;
  const selectedLocation: LocationOption | undefined = LOCATIONS.includes(
    (rawLocation as LocationOption) ?? ("" as LocationOption)
  )
    ? (rawLocation as LocationOption)
    : undefined;

  return (
    <AdminPageWrapper
      title="Admin Dashboard"
      description="Overview of volunteer portal activity and management tools."
    >
      <div data-testid="admin-dashboard-page" className="space-y-6">
        {/* Location Filter - renders instantly */}
        <LocationFilterTabs
          locations={LOCATIONS}
          selectedLocation={selectedLocation}
          basePath="/admin"
        />

        {/* Heavy data content streams in via Suspense */}
        <Suspense fallback={<AdminDashboardContentSkeleton />}>
          <AdminDashboardContent
            selectedLocation={selectedLocation}
            sessionUserId={session.user.id}
          />
        </Suspense>
      </div>
    </AdminPageWrapper>
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { RestaurantAnalyticsClient } from "./restaurant-analytics-client";
import { LOCATIONS } from "@/lib/locations";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/analytics");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;

  // Calculate default dates - last 30 days
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const initialFilters = {
    location: (params.location as string) || "all",
    startDate: (params.startDate as string) || thirtyDaysAgo.toISOString(),
    endDate: (params.endDate as string) || now.toISOString(),
  };

  // Transform LOCATIONS array to the format expected by the component
  const locationOptions = LOCATIONS.map((loc) => ({
    value: loc,
    label: loc,
  }));

  return (
    <AdminPageWrapper
      title="Restaurant Analytics"
      description="Key statistics and metrics for restaurant operations across all locations"
    >
      <PageContainer testid="restaurant-analytics-page">
        <RestaurantAnalyticsClient
          initialFilters={initialFilters}
          locations={locationOptions}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

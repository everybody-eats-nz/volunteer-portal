import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { RestaurantAnalyticsClient } from "./restaurant-analytics-client";
import { LOCATIONS } from "@/lib/locations";
import { getRestaurantAnalytics } from "@/lib/restaurant-analytics";

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
  const months = (params.months as string) || "3";
  const location = (params.location as string) || "all";

  const data = await getRestaurantAnalytics(parseInt(months, 10), location);

  const locationOptions = LOCATIONS.map((loc) => ({
    value: loc,
    label: loc,
  }));

  return (
    <AdminPageWrapper
      title="Restaurant Analytics"
      description="Meals served metrics and year-over-year comparisons across all locations"
    >
      <PageContainer testid="restaurant-analytics-page">
        <RestaurantAnalyticsClient
          data={data}
          months={months}
          location={location}
          locations={locationOptions}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

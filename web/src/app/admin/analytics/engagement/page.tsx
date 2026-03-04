import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { EngagementAnalyticsClient } from "./engagement-analytics-client";
import { LOCATIONS } from "@/lib/locations";
import { getEngagementSummary } from "@/lib/engagement";

export default async function EngagementAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/analytics/engagement");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;

  const months = (params.months as string) || "3";
  const location = (params.location as string) || "all";

  const data = await getEngagementSummary(parseInt(months, 10), location);

  const locationOptions = LOCATIONS.map((loc) => ({
    value: loc,
    label: loc,
  }));

  return (
    <AdminPageWrapper
      title="Volunteer Engagement"
      description="Track volunteer activity levels, engagement trends, and retention metrics"
    >
      <PageContainer testid="engagement-analytics-page">
        <EngagementAnalyticsClient
          data={data}
          months={months}
          location={location}
          locations={locationOptions}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

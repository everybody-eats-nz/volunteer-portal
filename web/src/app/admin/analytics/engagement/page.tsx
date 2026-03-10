import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { EngagementAnalyticsClient } from "./engagement-analytics-client";
import { LOCATIONS } from "@/lib/locations";
import { getEngagementSummary, getEngagementVolunteers, getEngagementByShiftType, getRetentionHeatmap } from "@/lib/engagement";

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

  // Table params
  const tablePage = parseInt((params.page as string) || "1", 10);
  const tablePageSize = parseInt((params.pageSize as string) || "20", 10);
  const tableSortBy = (params.sortBy as string) || "lastShiftDate";
  const tableSortOrder = ((params.sortOrder as string) || "desc") as
    | "asc"
    | "desc";
  const tableStatus = (params.status as string) || "";
  const tableSearch = (params.search as string) || "";

  const [data, shiftTypeData, volunteersData, retentionData] = await Promise.all([
    getEngagementSummary(parseInt(months, 10), location),
    getEngagementByShiftType(parseInt(months, 10), location),
    getEngagementVolunteers({
      months: parseInt(months, 10),
      location,
      statusFilter: tableStatus || null,
      page: tablePage,
      pageSize: tablePageSize,
      sortBy: tableSortBy,
      sortOrder: tableSortOrder,
      search: tableSearch,
    }),
    getRetentionHeatmap(location),
  ]);

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
          shiftTypeData={shiftTypeData}
          retentionData={retentionData}
          months={months}
          location={location}
          locations={locationOptions}
          volunteersData={volunteersData}
          tableSearch={tableSearch}
          tableStatus={tableStatus}
          tableSortBy={tableSortBy}
          tableSortOrder={tableSortOrder}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { MilestoneAnalyticsClient } from "./milestone-analytics-client";
import { LOCATIONS } from "@/lib/locations";
import { getMilestoneData } from "@/lib/milestone-analytics";

export default async function MilestoneAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/analytics/milestones");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const months = (params.months as string) || "12";
  const location = (params.location as string) || "all";

  const data = await getMilestoneData(parseInt(months, 10), location);

  const locationOptions = LOCATIONS.map((loc) => ({
    value: loc,
    label: loc,
  }));

  return (
    <AdminPageWrapper
      title="Milestone Analytics"
      description="Track when volunteers hit key shift milestones and project future recognition opportunities"
    >
      <PageContainer testid="milestone-analytics-page">
        <MilestoneAnalyticsClient
          data={data}
          months={months}
          location={location}
          locations={locationOptions}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

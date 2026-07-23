import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { CoverageAnalyticsClient } from "./coverage-analytics-client";
import { getActiveLocationNames } from "@/lib/locations";
import { getShiftCoverage } from "@/lib/shift-coverage";
import { parseDaysParam } from "@/lib/parse-days-param";

export default async function CoverageAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/analytics/coverage");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;

  const months = (params.months as string) || "3";
  const location = (params.location as string) || "all";
  const days = (params.days as string) || "";
  const daysFilter = parseDaysParam(days);

  const data = await getShiftCoverage(parseInt(months, 10), location, daysFilter);

  const locationOptions = (await getActiveLocationNames()).map((loc) => ({
    value: loc,
    label: loc,
  }));

  return (
    <AdminPageWrapper
      title="Shift Coverage"
      description="Shifts run, positions filled, and understaffing by restaurant"
    >
      <PageContainer testid="coverage-analytics-page">
        <CoverageAnalyticsClient
          data={data}
          months={months}
          location={location}
          days={days}
          locations={locationOptions}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { RecruitmentAnalyticsClient } from "./recruitment-analytics-client";
import { LOCATIONS } from "@/lib/locations";
import { getRecruitmentData } from "@/lib/recruitment";

export default async function RecruitmentAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/analytics/recruitment");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const months = (params.months as string) || "3";
  const location = (params.location as string) || "all";

  const data = await getRecruitmentData(parseInt(months, 10), location);

  const locationOptions = LOCATIONS.map((loc) => ({
    value: loc,
    label: loc,
  }));

  return (
    <AdminPageWrapper
      title="Volunteer Recruitment"
      description="New registrations, onboarding conversion, and time-to-first-shift metrics"
    >
      <PageContainer testid="recruitment-analytics-page">
        <RecruitmentAnalyticsClient
          data={data}
          months={months}
          location={location}
          locations={locationOptions}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

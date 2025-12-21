import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { AnalyticsClient } from "./analytics-client";

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
  const initialFilters = {
    location: (params.location as string) || "all",
    startDate:
      (params.startDate as string) ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: (params.endDate as string) || new Date().toISOString(),
    volunteerGrade: params.volunteerGrade as string | undefined,
    shiftTypeId: params.shiftTypeId as string | undefined,
  };

  return (
    <AdminPageWrapper
      title="Analytics Dashboard (Beta)"
      description="Comprehensive insights into volunteer engagement and operations. This feature is in beta - your feedback is welcome!"
    >
      <PageContainer testid="analytics-page">
        <AnalyticsClient initialFilters={initialFilters} />
      </PageContainer>
    </AdminPageWrapper>
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { ShortageNotificationsAnalyticsClient } from "./shortage-notifications-analytics-client";
import { LOCATIONS } from "@/lib/locations";
import { getShortageNotificationAnalytics } from "@/lib/shortage-analytics";

export default async function ShortageNotificationsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/analytics/shortage-notifications");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;

  const months = (params.months as string) || "12";
  const location = (params.location as string) || "all";
  const monthsNum = months === "all" ? 0 : parseInt(months, 10) || 12;

  const data = await getShortageNotificationAnalytics(monthsNum, location);

  const locationOptions = LOCATIONS.map((loc) => ({
    value: loc,
    label: loc,
  }));

  return (
    <AdminPageWrapper
      title="Shortage Notifications"
      description="Shift-shortage alerts sent to volunteers and the signups they drove, org-wide and by restaurant"
    >
      <PageContainer testid="shortage-notifications-analytics-page">
        <ShortageNotificationsAnalyticsClient
          data={data}
          months={months}
          location={location}
          locations={locationOptions}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

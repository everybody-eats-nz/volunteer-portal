import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { ShortageNotificationsAnalyticsClient } from "./shortage-notifications-analytics-client";
import { getActiveLocationNames } from "@/lib/locations";
import {
  getShortageNotificationAnalytics,
  getShortageConverters,
  parseMonthsParam,
  CONVERSION_WINDOW_DAYS,
} from "@/lib/shortage-analytics";

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
  const monthsNum = parseMonthsParam(months);

  const [data, convertersResult] = await Promise.all([
    getShortageNotificationAnalytics(monthsNum, location),
    getShortageConverters(monthsNum, location),
  ]);

  const locationOptions = (await getActiveLocationNames()).map((loc) => ({
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
          converters={convertersResult}
          months={months}
          location={location}
          locations={locationOptions}
          windowDays={CONVERSION_WINDOW_DAYS}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

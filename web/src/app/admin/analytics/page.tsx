import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { AnalyticsDashboard } from "./_components/analytics-dashboard";
import { LOCATIONS } from "@/lib/locations";
import { prisma } from "@/lib/prisma";
import { getRestaurantAnalytics } from "@/lib/restaurant-analytics";
import { getRestaurantReports } from "@/lib/restaurant-reports";
import { parseDaysParam } from "@/lib/parse-days-param";
import { nowInNZT } from "@/lib/timezone";

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
  const months = (params.months as string) || "ytd";
  const location = (params.location as string) || "all";
  const days = (params.days as string) || "";
  const from = (params.from as string) || "";
  const to = (params.to as string) || "";
  const daysFilter = parseDaysParam(days);
  // "all" → 0, a sentinel the libs treat as "all time" (earliest record → today)
  const monthsNum = months === "all" ? 0 : parseInt(months, 10) || 3;

  // YTD resolves to an explicit Jan 1 → today window, handed to the libs via
  // their custom-range path (whose year-over-year comparison shifts both ends
  // back exactly one year — i.e. "this year so far vs the same point last year").
  let effFrom = from || null;
  let effTo = to || null;
  if (months === "ytd" && !(from && to)) {
    const nz = nowInNZT();
    const pad = (n: number) => String(n).padStart(2, "0");
    effFrom = `${nz.getFullYear()}-01-01`;
    effTo = `${nz.getFullYear()}-${pad(nz.getMonth() + 1)}-${pad(nz.getDate())}`;
  }

  const [data, reports] = await Promise.all([
    getRestaurantAnalytics(monthsNum, location, daysFilter, effFrom, effTo),
    getRestaurantReports(monthsNum, location, daysFilter, effFrom, effTo),
  ]);

  // Offer every venue that has service-night data (incl. historical pop-ups),
  // union the active main venues so they always appear even with no data yet.
  const dataLocations = (
    await prisma.mealsServed.findMany({
      distinct: ["location"],
      select: { location: true },
    })
  ).map((l) => l.location);
  const locationOptions = Array.from(new Set([...LOCATIONS, ...dataLocations]))
    .sort((a, b) => a.localeCompare(b))
    .map((loc) => ({ value: loc, label: loc }));

  return (
    <AdminPageWrapper
      title="Restaurant Analytics"
      description="Guests served, koha, volunteers and service-night insights across all locations"
    >
      <PageContainer testid="restaurant-analytics-page">
        <AnalyticsDashboard
          data={data}
          reports={reports}
          months={months}
          location={location}
          days={days}
          from={from}
          to={to}
          locations={locationOptions}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

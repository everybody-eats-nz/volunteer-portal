import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { getActiveLocationNames } from "@/lib/locations";
import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";
import {
  budgetYearOf,
  budgetYearRange,
  currentBudgetYear,
} from "@/lib/budget-calculations";
import { buildCafeReport, buildEventsReport } from "@/lib/events-cafe-report";
import type { Prisma } from "@/generated/client";
import { EventsCafeClient } from "./events-cafe-client";

// Everything that isn't a service night, i.e. isn't koha.
const OTHER_ACTIVITY: Prisma.MealsServedWhereInput = {
  reportType: { in: ["EVENT", "CAFE"] },
};

const decimal = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export default async function EventsCafePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/analytics/events");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;

  const [earliest, dataLocations, activeLocations] = await Promise.all([
    prisma.mealsServed.aggregate({
      where: OTHER_ACTIVITY,
      _min: { date: true },
    }),
    prisma.mealsServed.findMany({
      where: OTHER_ACTIVITY,
      distinct: ["location"],
      select: { location: true },
    }),
    getActiveLocationNames(),
  ]);

  // Financial years from the first event or cafe day to now, newest first.
  const currentYear = currentBudgetYear();
  const firstYear = earliest._min.date
    ? Math.min(budgetYearOf(earliest._min.date), currentYear)
    : currentYear;
  const years: number[] = [];
  for (let y = currentYear; y >= firstYear; y--) years.push(y);

  const requestedYear = str(params.year);
  const period: number | "all" =
    requestedYear === "all"
      ? "all"
      : years.includes(Number(requestedYear))
        ? Number(requestedYear)
        : currentYear;

  const locations = Array.from(
    new Set([...activeLocations, ...dataLocations.map((l) => l.location)])
  ).sort((a, b) => a.localeCompare(b));
  const requestedLocation = str(params.location);
  const location =
    requestedLocation && locations.includes(requestedLocation)
      ? requestedLocation
      : "all";

  const range = period === "all" ? null : budgetYearRange(period);
  const records = await prisma.mealsServed.findMany({
    where: {
      ...OTHER_ACTIVITY,
      ...(range ? { date: { gte: range.start, lt: range.end } } : {}),
      ...(location === "all" ? {} : { location }),
    },
    select: {
      date: true,
      location: true,
      reportType: true,
      eventName: true,
      mealsServed: true,
      opensAt: true,
      closesAt: true,
      cash: true,
      eftpos: true,
      income: {
        select: {
          source: true,
          category: true,
          amount: true,
          gstIncluded: true,
        },
      },
    },
  });

  const events = buildEventsReport(
    records
      .filter((r) => r.reportType === "EVENT")
      .map((r) => ({
        date: formatInNZT(r.date, "yyyy-MM-dd"),
        location: r.location,
        eventName: r.eventName,
        pax: r.mealsServed,
        income: r.income.map((line) => ({
          ...line,
          amount: Number(line.amount),
        })),
      }))
  );
  const cafe = buildCafeReport(
    records
      .filter((r) => r.reportType === "CAFE")
      .map((r) => ({
        date: formatInNZT(r.date, "yyyy-MM-dd"),
        location: r.location,
        opensAt: r.opensAt,
        closesAt: r.closesAt,
        customers: r.mealsServed,
        cash: decimal(r.cash),
        eftpos: decimal(r.eftpos),
      }))
  );

  return (
    <AdminPageWrapper
      title="Events & Cafe"
      description="Fundraiser income and cafe takings, kept separate from koha"
    >
      <PageContainer testid="events-cafe-page">
        <EventsCafeClient
          events={events}
          cafe={cafe}
          years={years}
          period={period}
          location={location}
          locations={locations}
          view={str(params.view) === "cafe" ? "cafe" : "events"}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

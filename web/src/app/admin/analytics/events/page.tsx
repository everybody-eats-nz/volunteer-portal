import type { Metadata } from "next";
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
import { isActivityKind, type FundraisingActivityKind } from "@/lib/day-reports";
import type { Prisma } from "@/generated/client";
import { EventsCafeClient } from "./events-cafe-client";

const DESCRIPTION =
  "Event and catering income and profit, and cafe takings, kept separate from koha";

export const metadata: Metadata = {
  title: "Events & Cafe",
  description: DESCRIPTION,
};

// Every day with something that isn't koha: an events or cafe day, or a
// service night that also ran an event or catering gig.
const OTHER_ACTIVITY: Prisma.MealsServedWhereInput = {
  OR: [
    { reportType: { in: ["EVENT", "CAFE"] } },
    { activities: { some: {} } },
  ],
};

const lineFields = {
  income: {
    select: {
      source: true,
      category: true,
      amount: true,
      gstIncluded: true,
      estimated: true,
    },
  },
  expenses: {
    select: {
      category: true,
      amount: true,
      gstIncluded: true,
      estimated: true,
    },
  },
} as const;

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

  // Financial years from the first event, catering gig or cafe day to now,
  // newest first.
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

  const requestedKind = str(params.kind);
  const kind: FundraisingActivityKind | "all" = isActivityKind(requestedKind)
    ? requestedKind
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
      mealsServed: true,
      opensAt: true,
      closesAt: true,
      cash: true,
      eftpos: true,
      activities: {
        select: {
          kind: true,
          name: true,
          pax: true,
          position: true,
          ...lineFields,
        },
      },
    },
  });

  const activities = records.flatMap((r) =>
    r.activities.map((a) => ({
      date: formatInNZT(r.date, "yyyy-MM-dd"),
      location: r.location,
      position: a.position,
      kind: a.kind,
      name: a.name,
      pax: a.pax,
      income: a.income.map((line) => ({ ...line, amount: Number(line.amount) })),
      expenses: a.expenses.map((line) => ({
        ...line,
        amount: Number(line.amount),
      })),
    }))
  );
  const kindCounts = buildEventsReport(activities).totals.byKind;
  const events = buildEventsReport(
    kind === "all" ? activities : activities.filter((a) => a.kind === kind)
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
    <AdminPageWrapper title="Events & Cafe" description={DESCRIPTION}>
      <PageContainer testid="events-cafe-page">
        <EventsCafeClient
          events={events}
          kind={kind}
          kindCounts={kindCounts}
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

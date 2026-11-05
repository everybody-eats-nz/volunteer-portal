import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { subMonths } from "date-fns";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { getActiveLocationNames } from "@/lib/locations";
import { formatInNZT } from "@/lib/timezone";
import {
  RESPONSE_TARGET_HOURS,
  summariseApplications,
  summariseByLocation,
  type ApplicationRecord,
} from "@/lib/application-responses";
import {
  ApplicationsAnalyticsClient,
  type OverdueApplication,
} from "./applications-analytics-client";

export const metadata: Metadata = {
  title: "Shift Applications",
  description:
    "How quickly shift applications are answered, and how many are declined, by restaurant",
};

const HOUR_MS = 60 * 60 * 1000;
const PERIODS = new Set(["1", "3", "6", "12"]);
/** Oldest first, so the cut only ever drops the newest overdue ones. */
const OVERDUE_LIMIT = 100;

export default async function ApplicationsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/analytics/applications");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const monthsParam = typeof params.months === "string" ? params.months : "1";
  const months = PERIODS.has(monthsParam) ? monthsParam : "1";
  const location =
    typeof params.location === "string" && params.location
      ? params.location
      : "all";

  const now = new Date();
  const since = subMonths(now, parseInt(months, 10));
  const locationWhere = location === "all" ? {} : { location };

  const [rows, backlog, locationNames] = await Promise.all([
    prisma.signup.findMany({
      where: { appliedAt: { gte: since }, shift: locationWhere },
      select: {
        appliedAt: true,
        respondedAt: true,
        response: true,
        status: true,
        shift: { select: { location: true, start: true } },
      },
    }),
    // The backlog is whatever is overdue right now, whenever it came in.
    prisma.signup.findMany({
      where: {
        status: "PENDING",
        appliedAt: {
          not: null,
          lte: new Date(now.getTime() - RESPONSE_TARGET_HOURS * HOUR_MS),
        },
        shift: { ...locationWhere, start: { gt: now } },
      },
      orderBy: { appliedAt: "asc" },
      take: OVERDUE_LIMIT,
      select: {
        id: true,
        appliedAt: true,
        user: {
          select: { id: true, name: true, firstName: true, lastName: true, email: true },
        },
        shift: {
          select: {
            start: true,
            location: true,
            shiftType: { select: { name: true } },
          },
        },
      },
    }),
    getActiveLocationNames(),
  ]);

  const apps: ApplicationRecord[] = rows.map((r) => ({
    appliedAt: r.appliedAt!,
    respondedAt: r.respondedAt,
    response: r.response,
    status: r.status,
    location: r.shift.location,
    shiftStart: r.shift.start,
  }));

  const overdue: OverdueApplication[] = backlog.map((s) => ({
    signupId: s.id,
    volunteerId: s.user.id,
    volunteerName:
      [s.user.firstName, s.user.lastName].filter(Boolean).join(" ") ||
      s.user.name ||
      s.user.email,
    shiftName: s.shift.shiftType.name,
    shiftWhen: formatInNZT(s.shift.start, "EEE d MMM, h:mma"),
    location: s.shift.location,
    rosterHref: `/admin/shifts?${new URLSearchParams({
      date: formatInNZT(s.shift.start, "yyyy-MM-dd"),
      ...(s.shift.location ? { location: s.shift.location } : {}),
    }).toString()}`,
    waitingHours: (now.getTime() - s.appliedAt!.getTime()) / HOUR_MS,
  }));

  return (
    <AdminPageWrapper
      title="Shift Applications"
      description="How quickly shift applications are answered, and how many are declined, by restaurant"
    >
      <PageContainer testid="applications-analytics-page">
        <ApplicationsAnalyticsClient
          totals={summariseApplications(apps, now)}
          byLocation={summariseByLocation(apps, now)}
          overdue={overdue}
          overdueTruncated={backlog.length === OVERDUE_LIMIT}
          months={months}
          location={location}
          locations={locationNames.map((l) => ({ value: l, label: l }))}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { getActiveLocationNames } from "@/lib/locations";
import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";
import { parseCashRangeParams } from "@/lib/cash-reconciliation";
import { getCashReconciliation } from "@/lib/cash-reconciliation.server";
import { CashReconciliationClient } from "./cash-reconciliation-client";

export default async function CashReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/analytics/cash");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;

  // Every venue that has recorded nights (incl. historical pop-ups), plus the
  // active venues so a new one is offered before its first night.
  const [dataLocations, activeLocations, admin] = await Promise.all([
    prisma.mealsServed.findMany({
      distinct: ["location"],
      select: { location: true },
    }),
    getActiveLocationNames(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { defaultLocation: true },
    }),
  ]);
  const locations = Array.from(
    new Set([...activeLocations, ...dataLocations.map((l) => l.location)])
  ).sort((a, b) => a.localeCompare(b));

  // Cash is reconciled one venue at a time: the requested one, else the
  // admin's own venue, else the first.
  const requested = str(params.location);
  const location =
    (requested && locations.includes(requested) && requested) ||
    (admin?.defaultLocation &&
      locations.includes(admin.defaultLocation) &&
      admin.defaultLocation) ||
    locations[0] ||
    "";

  const today = formatInNZT(new Date(), "yyyy-MM-dd");
  const range = parseCashRangeParams(
    {
      range: str(params.range),
      from: str(params.from),
      to: str(params.to),
    },
    today
  );

  const data = location
    ? await getCashReconciliation({ location, from: range.from, to: range.to })
    : null;

  return (
    <AdminPageWrapper
      title="Cash Reconciliation"
      description="Cash koha per service night for one restaurant, totalled to check against a bank deposit"
    >
      <PageContainer testid="cash-reconciliation-page">
        <CashReconciliationClient
          data={data}
          location={location}
          locations={locations}
          range={range.range}
          from={range.from}
          to={range.to}
          today={today}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { getBudgetTracking } from "@/lib/budget-tracking";
import { resolveBudgetPeriod } from "@/lib/budget-periods";
import { formatInNZT } from "@/lib/timezone";
import { BudgetTrackingClient } from "./budget-tracking-client";

export const metadata: Metadata = {
  title: "Budget Tracking",
  description: "Koha against each restaurant's annual budget, night by night",
};

export default async function BudgetTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/analytics/budget");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const param = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  const period = resolveBudgetPeriod(
    {
      period: param("period"),
      year: param("year"),
      date: param("date"),
      from: param("from"),
      to: param("to"),
    },
    formatInNZT(new Date(), "yyyy-MM-dd")
  );
  const requestedLocation = param("location") || "all";

  const data = await getBudgetTracking(
    period,
    requestedLocation === "all" ? null : requestedLocation
  );
  // An unknown name (renamed or disabled venue) falls back to all restaurants.
  const location = data.selected ? data.selected.location : "all";

  return (
    <AdminPageWrapper
      title="Budget Tracking"
      description="Koha against each restaurant's annual budget, night by night"
    >
      <PageContainer testid="budget-tracking-page">
        <BudgetTrackingClient data={data} location={location} />
      </PageContainer>
    </AdminPageWrapper>
  );
}

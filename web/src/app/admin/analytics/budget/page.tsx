import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { getBudgetTracking } from "@/lib/budget-tracking";
import { currentBudgetYear } from "@/lib/budget-calculations";
import { BudgetTrackingClient } from "./budget-tracking-client";

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
  const currentYear = currentBudgetYear();
  const requestedYear = parseInt(params.year as string, 10);
  const year =
    Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100
      ? requestedYear
      : currentYear;
  const requestedLocation = (params.location as string) || "all";

  const data = await getBudgetTracking(
    year,
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

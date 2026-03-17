import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardStatsSkeleton } from "@/components/dashboard-stats-skeleton";
import { DashboardContentSkeleton } from "@/components/dashboard-content-skeleton";

export default function DashboardLoading() {
  return (
    <PageContainer>
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="h-10 w-56 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Stats skeleton */}
      <DashboardStatsSkeleton />

      {/* Content grid skeleton */}
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <DashboardContentSkeleton />
        <DashboardContentSkeleton />
        <DashboardContentSkeleton />
        <DashboardContentSkeleton />
      </div>
    </PageContainer>
  );
}

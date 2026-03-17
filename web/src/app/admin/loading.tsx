import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for just the dashboard content (used as Suspense fallback) */
export function AdminDashboardContentSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Grid Skeleton - 3 rows of 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={`stat-${i}`}
            className="bg-card rounded-sm border py-6 px-6 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Attention Required + Week Summary - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Attention Required Skeleton */}
        <div className="bg-card rounded-sm border py-6 px-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`attention-${i}`}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* Week Summary Skeleton */}
        <div className="bg-card rounded-sm border py-6 px-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`week-${i}`}
                className="p-3 rounded-lg border space-y-2"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
          <div className="p-3 rounded-lg border space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      </div>

      {/* Upcoming Shifts + Quick Actions - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Upcoming Shifts Skeleton */}
        <div className="bg-card rounded-sm border py-6 px-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`shift-day-${i}`} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div
                      key={`shift-${i}-${j}`}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-6 w-12 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Skeleton */}
        <div className="bg-card rounded-sm border py-6 px-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`action-${i}`}
                className="flex items-center gap-3 p-3 rounded-lg border"
              >
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Skeleton */}
      <div className="bg-card rounded-sm border py-6 px-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`activity-${i}`}
              className="flex items-center gap-3 p-3 rounded-lg border"
            >
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Full-page loading skeleton (used by Next.js route-level loading) */
export default function AdminDashboardLoading() {
  return (
    <AdminPageWrapper
      title="Admin Dashboard"
      description="Overview of volunteer portal activity and management tools."
    >
      <div data-testid="admin-dashboard-page" className="space-y-6">
        {/* Location Filter Skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-[180px]" />
        </div>

        <AdminDashboardContentSkeleton />
      </div>
    </AdminPageWrapper>
  );
}

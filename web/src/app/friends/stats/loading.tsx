import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function FriendsStatsLoading() {
  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Back button skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-40" />
        </div>

        {/* Header skeleton */}
        <div>
          <Skeleton className="h-10 w-56 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Stats grid skeleton - 4 stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border rounded-lg p-6 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>

        {/* Two cards side by side skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Friendships card */}
          <div className="bg-card border rounded-lg">
            <div className="p-6 pb-0">
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Most Active Friend card */}
          <div className="bg-card border rounded-lg">
            <div className="p-6 pb-0">
              <Skeleton className="h-6 w-44" />
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full rounded" />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Friends' Upcoming Activity card skeleton */}
        <div className="bg-card border rounded-lg">
          <div className="p-6 pb-0">
            <Skeleton className="h-6 w-56" />
          </div>
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 border rounded-lg"
              >
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
            <Skeleton className="h-9 w-full rounded" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

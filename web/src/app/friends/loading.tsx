import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function FriendsLoading() {
  return (
    <PageContainer>
      {/* Header skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2 mb-8">
        <div className="flex-1">
          <Skeleton className="h-10 w-40 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Search and buttons skeleton */}
      <div className="space-y-6">
        <div className="bg-muted/30 rounded-xl p-8 border">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
            <div className="flex-1 max-w-xl space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="flex space-x-1 bg-muted/50 p-1 rounded-lg w-fit">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>

        {/* Cards skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-card border rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8 rounded" />
              </div>
              <Skeleton className="h-9 w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

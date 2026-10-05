import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function BudgetTrackingLoading() {
  return (
    <AdminPageSkeleton
      title="Budget Tracking"
      description="Koha against each restaurant's annual budget, night by night"
    >
      {/* Filters */}
      <SkeletonCard className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[16rem_10rem]">
          {["restaurant", "year"].map((key) => (
            <div key={key} className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Combined summary */}
      <SkeletonCard className="space-y-4 p-6">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-7 w-80 max-w-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-64" />
      </SkeletonCard>

      {/* Restaurant cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {["a", "b", "c"].map((key) => (
          <SkeletonCard key={key} className="space-y-4 p-5">
            <div className="flex items-start justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-3 border-t pt-3">
              {["x", "y", "z"].map((stat) => (
                <div key={stat} className="space-y-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </AdminPageSkeleton>
  );
}

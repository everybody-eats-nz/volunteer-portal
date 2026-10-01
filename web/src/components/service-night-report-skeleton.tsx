import { SkeletonCard } from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Collapsed Service Night Report placeholder. Shared by the shifts route
 * `loading.tsx` and MealsServedInput's own fetch so both match the real card.
 */
export function ServiceNightReportSkeleton() {
  return (
    <SkeletonCard className="mb-6 overflow-hidden">
      <div className="border-b px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="flex flex-col items-start gap-2.5 sm:items-end">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-32 rounded-full" />
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="w-48 space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border px-3.5 py-2.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 px-6 py-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-16 w-full" />
      </div>
    </SkeletonCard>
  );
}

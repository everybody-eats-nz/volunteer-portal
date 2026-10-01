import {
  AdminPageSkeleton,
  SkeletonCard,
  TabsSkeleton,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Section heading plus a grid of `StatsCard`s (value, title, icon tile). */
function StatsGridSkeleton({
  count,
  className,
}: {
  count: number;
  className: string;
}) {
  return (
    <div>
      <Skeleton className="mb-3 h-6 w-44" />
      <div className={cn("grid grid-cols-1 gap-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} className="rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="size-11 shrink-0 rounded-xl" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

export default function ArchivingLoading() {
  return (
    <AdminPageSkeleton
      title="Volunteer Archiving"
      description={"Soft-archive inactive volunteers based on Nic's rules. Run passes manually while the cron is being set up \u2014 per-rule actions and a full activity log are available below."}
      className="space-y-2"
    >
      {/* Category tabs */}
      <div className="-mx-2 overflow-x-auto px-2">
        <TabsSkeleton
          tabs={["w-26", "w-34", "w-40", "w-50", "w-48", "w-38", "w-30"]}
          className="w-max"
        />
      </div>

      {/* Overview tab */}
      <div className="space-y-6">
        <SkeletonCard className="py-6">
          <div className="flex flex-col gap-4 px-6 md:flex-row md:items-start md:justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-4 w-full max-w-xl" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-9 w-36" />
            </div>
          </div>
        </SkeletonCard>

        <StatsGridSkeleton count={6} className="sm:grid-cols-2 lg:grid-cols-3" />
        <StatsGridSkeleton count={4} className="sm:grid-cols-2 lg:grid-cols-4" />
      </div>
    </AdminPageSkeleton>
  );
}

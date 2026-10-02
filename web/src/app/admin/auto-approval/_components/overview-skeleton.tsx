import {
  ChartCardSkeleton,
  SkeletonCard,
  SkeletonCardHeader,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const RULE_BARS = ["w-36", "w-44", "w-28", "w-40"];
const LOCATION_BARS = ["w-24", "w-32", "w-28"];

function BarListCardSkeleton({ labels }: { labels: string[] }) {
  return (
    <SkeletonCard className="space-y-6 py-6">
      <SkeletonCardHeader titleWidth="w-48" />
      <ul className="space-y-3 px-6">
        {labels.map((width, i) => (
          <li key={i} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className={`h-4 ${width}`} />
              <Skeleton className="h-4 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </li>
        ))}
      </ul>
    </SkeletonCard>
  );
}

/** Overview tab placeholder - shared by the route `loading.tsx` and the tab's own fetch. */
export function OverviewTabSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="h-8 w-56 rounded-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard
            key={i}
            className="flex items-center justify-between gap-3 p-5"
          >
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="size-11 shrink-0 rounded-xl" />
          </SkeletonCard>
        ))}
      </div>

      <ChartCardSkeleton height={300} />

      <div className="grid gap-6 lg:grid-cols-2">
        <BarListCardSkeleton labels={RULE_BARS} />
        <BarListCardSkeleton labels={LOCATION_BARS} />
      </div>

      <SkeletonCard className="space-y-6 py-6">
        <SkeletonCardHeader titleWidth="w-36" action="w-14" />
        <ul className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-6 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="hidden h-3 w-56 md:block" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </li>
          ))}
        </ul>
      </SkeletonCard>
    </div>
  );
}

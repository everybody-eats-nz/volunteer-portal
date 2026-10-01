import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Deterministic bar widths for the distribution placeholders.
const DISTRIBUTIONS = [
  ["w-4/5", "w-1/2", "w-1/4"],
  ["w-3/5", "w-2/5"],
  ["w-2/3", "w-1/2", "w-1/3", "w-1/5"],
  ["w-3/4", "w-1/3", "w-1/6"],
];

export default function SurveyResponsesLoading() {
  return (
    <AdminPageSkeleton title="Survey Responses">
      <Skeleton className="-ml-2 h-8 w-40" />

      <SkeletonCard className="overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <Skeleton className="size-[104px] shrink-0 rounded-full" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-7 w-64 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 shrink-0 self-start lg:self-center" />
        </div>
        <div className="grid grid-cols-2 divide-x divide-y border-t sm:grid-cols-4 sm:divide-y-0">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </SkeletonCard>

      <SkeletonCard className="rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-3 w-12" />
          {["w-36", "w-32", "w-32", "w-40"].map((width, i) => (
            <Skeleton key={i} className={`h-9 ${width}`} />
          ))}
        </div>
      </SkeletonCard>

      <div
        aria-hidden="true"
        className="bg-muted/40 inline-flex w-full gap-1 rounded-xl border p-1 sm:w-auto"
      >
        <Skeleton className="bg-background h-9 flex-1 rounded-lg shadow-sm sm:w-32 sm:flex-initial" />
        <Skeleton className="h-9 flex-1 rounded-lg bg-transparent sm:w-40 sm:flex-initial" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {DISTRIBUTIONS.map((bars, i) => (
          <SkeletonCard
            key={i}
            className="flex flex-col overflow-hidden rounded-xl"
          >
            <div className="flex items-start gap-3 border-b p-4">
              <Skeleton className="mt-0.5 size-7 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex-1 space-y-2.5 p-4">
              {bars.map((width, j) => (
                <div key={j} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <div className="bg-muted/60 h-2.5 overflow-hidden rounded-full">
                    <Skeleton className={`h-full rounded-full ${width}`} />
                  </div>
                </div>
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </AdminPageSkeleton>
  );
}

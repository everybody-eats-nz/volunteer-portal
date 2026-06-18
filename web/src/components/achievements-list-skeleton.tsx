import { Skeleton } from "@/components/ui/skeleton";

export function AchievementsListSkeleton() {
  return (
    <section>
      {/* Section header skeleton — eyebrow + display title + toggle pill */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-block h-px w-8 bg-forest-500/30 dark:bg-cream-50/25" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-9 w-64 sm:h-10" />
        </div>
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>

      {/* Filter pills skeleton */}
      <div className="mt-8 flex flex-wrap gap-2.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>

      {/* Gallery grid skeleton */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="relative flex flex-col overflow-hidden rounded-3xl border border-forest-500/10 p-6 dark:border-cream-50/10"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest-500/20 to-forest-300/20 dark:from-cream-50/10 dark:to-cream-50/5" />
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <Skeleton className="h-5 w-14" />
            </div>
            <Skeleton className="mt-4 h-5 w-36" />
            <div className="mt-2 flex gap-1.5">
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-3/4" />
            {i % 2 === 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

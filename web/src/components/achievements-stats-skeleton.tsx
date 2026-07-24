import { Skeleton } from "@/components/ui/skeleton";

export function AchievementsStatsSkeleton() {
  return (
    <>
      {/* Trophy cabinet skeleton — mirrors the dark forest panel so the page
          doesn't flash from light to dark when the stats stream in. */}
      <section className="grain relative overflow-hidden rounded-[2.5rem] bg-forest-700 px-6 py-10 sm:px-12 sm:py-14">
        <div className="relative">
          {/* Eyebrow */}
          <div className="mb-8 flex items-center gap-3">
            <span className="inline-block h-px w-8 bg-sun-200/30" />
            <Skeleton className="h-3 w-44 bg-cream-50/10" />
          </div>

          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            {/* Hero points figure */}
            <div>
              <Skeleton className="h-20 w-40 bg-cream-50/10 sm:h-24" />
              <Skeleton className="mt-3 h-3 w-24 bg-cream-50/10" />
              <Skeleton className="mt-2 h-3 w-32 bg-cream-50/10" />
            </div>

            {/* Stat strip */}
            <div className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-cream-50/10 lg:max-w-2xl">
              {[1, 2, 3].map((i) => (
                <div key={i} className="sm:px-8 sm:first:pl-0 sm:last:pr-0">
                  <Skeleton className="h-9 w-20 bg-cream-50/10" />
                  <Skeleton className="mt-3 h-3 w-16 bg-cream-50/10" />
                  <Skeleton className="mt-2 h-3 w-24 bg-cream-50/10" />
                </div>
              ))}
            </div>
          </div>

          {/* Completion bar */}
          <div className="mt-12">
            <div className="mb-2.5 flex items-center justify-between">
              <Skeleton className="h-3 w-44 bg-cream-50/10" />
              <Skeleton className="h-3 w-8 bg-cream-50/10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full bg-cream-50/10" />
          </div>
        </div>
      </section>

      {/* Leaderboard skeleton — mirrors the cream collapsed panel */}
      <section className="grain relative overflow-hidden rounded-[2rem] border border-forest-500/10 bg-cream-100 dark:border-cream-50/10 dark:bg-forest-800/60">
        <div className="flex items-center gap-4 p-6 sm:p-8">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="flex-1">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </section>
    </>
  );
}

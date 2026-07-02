/** Loading state mirroring the redesigned layout: editorial stats band +
    schedule panel with timeline rows, so the swap-in doesn't shift layout. */
export function MyShiftsContentSkeleton() {
  return (
    <>
      {/* Stats band skeleton */}
      <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-forest-500/10 ring-1 ring-forest-500/10 lg:grid-cols-4 dark:bg-cream-50/10 dark:ring-cream-50/10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-background px-5 py-6 sm:px-8 sm:py-8">
            <div className="h-10 w-16 animate-pulse rounded-lg bg-muted sm:h-12" />
            <div className="mt-3 h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Schedule panel skeleton */}
      <div className="rounded-[2rem] border border-forest-500/10 bg-card p-5 sm:p-8 dark:border-cream-50/10">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-9 w-48 animate-pulse rounded-lg bg-muted sm:h-10" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
          </div>
        </div>

        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-3 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-forest-500/10 p-4 sm:gap-5 sm:p-5 dark:border-cream-50/10"
            >
              <div className="w-11 shrink-0 space-y-2 sm:w-12">
                <div className="mx-auto h-3 w-8 animate-pulse rounded bg-muted" />
                <div className="mx-auto h-7 w-9 animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="h-12 w-px shrink-0 bg-forest-500/10 dark:bg-cream-50/15" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="h-5 w-44 max-w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
              </div>
              <div className="hidden h-6 w-24 shrink-0 animate-pulse rounded-full bg-muted sm:block" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

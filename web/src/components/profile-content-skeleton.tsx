import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading shapes for the profile view — mirrors the redesigned layout:
 * a tall forest identity panel followed by the masonry of detail cards.
 * Shared by the page's Suspense fallback and the route loading state.
 */
export function ProfileContentSkeleton() {
  return (
    <div className="space-y-8">
      {/* Identity panel */}
      <div className="grain relative overflow-hidden rounded-[2rem] bg-forest-700/90 px-6 py-10 sm:rounded-[2.5rem] sm:px-10 dark:bg-forest-800/70">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-center">
          <Skeleton className="h-28 w-28 shrink-0 rounded-full bg-cream-50/15 sm:h-36 sm:w-36" />
          <div className="flex w-full flex-1 flex-col items-center gap-3 md:items-start">
            <Skeleton className="h-3 w-24 bg-cream-50/15" />
            <Skeleton className="h-9 w-56 bg-cream-50/15" />
            <Skeleton className="h-4 w-44 bg-cream-50/15" />
            <div className="mt-1 flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full bg-cream-50/15" />
              <Skeleton className="h-6 w-28 rounded-full bg-cream-50/15" />
            </div>
          </div>
          <Skeleton className="h-11 w-32 shrink-0 rounded-full bg-cream-50/15" />
        </div>
      </div>

      {/* Detail cards grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-3xl border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10"
          >
            <div className="mb-6 flex items-center gap-4">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="flex items-center justify-between border-b border-forest-500/10 py-3 last:border-0 dark:border-cream-50/10"
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

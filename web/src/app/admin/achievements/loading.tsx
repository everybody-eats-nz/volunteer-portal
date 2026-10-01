import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function AchievementsLoading() {
  return (
    <AdminPageSkeleton
      title="Achievements"
      description="Create and manage volunteer achievements"
    >
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="size-11 shrink-0 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Search, filters and create button */}
      <div className="bg-card rounded-lg border p-3 sm:p-4" aria-hidden="true">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-9 flex-1 sm:max-w-sm" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-[160px]" />
              <Skeleton className="h-9 w-[140px]" />
            </div>
          </div>
          <Skeleton className="h-9 w-44" />
        </div>
        <Skeleton className="mt-3 h-3 w-28" />
      </div>

      {/* Achievements table */}
      <div className="bg-card overflow-hidden rounded-lg border" aria-hidden="true">
        <div className="bg-muted/40 flex h-10 items-center gap-6 border-b px-4">
          <Skeleton className="size-4 shrink-0 rounded-[4px]" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="hidden h-3.5 w-20 md:block" />
          <Skeleton className="hidden h-3.5 w-12 md:block" />
          <Skeleton className="hidden h-3.5 w-16 md:block" />
          <Skeleton className="hidden h-3.5 w-14 md:block" />
          <span className="w-8" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 border-b px-4 py-3 last:border-0"
          >
            <Skeleton className="size-4 shrink-0 rounded-[4px]" />
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="min-w-0 space-y-1.5 pt-0.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
            </div>
            <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
            <Skeleton className="hidden h-4 w-12 md:block" />
            <Skeleton className="hidden h-6 w-16 md:block" />
            <Skeleton className="hidden h-5 w-14 rounded-full md:block" />
            <Skeleton className="size-8 shrink-0" />
          </div>
        ))}
      </div>
    </AdminPageSkeleton>
  );
}

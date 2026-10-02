import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomLabelsLoading() {
  return (
    <AdminPageSkeleton title="Custom Labels">
      {/* Hero */}
      <div
        className="rounded-xl border border-forest-500 bg-gradient-to-br from-forest-500 to-forest-400 p-6 shadow-sm sm:p-8"
        aria-hidden="true"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-xl space-y-3">
            <Skeleton className="h-7 w-full max-w-md bg-white/15 sm:h-8" />
            <Skeleton className="h-4 w-full bg-white/15" />
            <Skeleton className="h-4 w-2/3 bg-white/15" />
          </div>
          <Skeleton className="h-10 w-32 shrink-0 rounded-full bg-sun-200/40" />
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-xl border p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-8 w-12" />
          </div>
        ))}
      </div>

      {/* Search + sort */}
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        aria-hidden="true"
      >
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-9 w-80 max-w-full rounded-full" />
      </div>

      {/* Label cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-card flex flex-col rounded-xl border p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="flex items-center gap-0.5">
                <Skeleton className="size-8" />
                <Skeleton className="size-8" />
                <Skeleton className="size-8" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
            </div>
            <div className="mt-auto pt-4">
              <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="size-8 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="size-4 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminPageSkeleton>
  );
}

import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function CashReconciliationLoading() {
  return (
    <AdminPageSkeleton
      title="Cash Reconciliation"
      description="Cash koha per service night for one restaurant, totalled to check against a bank deposit"
      className="space-y-5"
    >
      {/* Controls */}
      <SkeletonCard className="flex flex-wrap items-center gap-2 p-3">
        <Skeleton className="h-8 w-[180px]" />
        <Skeleton className="h-8 w-[160px] rounded-lg md:h-9 md:w-[440px]" />
        <Skeleton className="h-8 w-32" />
      </SkeletonCard>

      {/* Deposit slip */}
      <div
        aria-hidden="true"
        className="grid gap-px overflow-hidden rounded-2xl bg-forest-500/10 ring-1 ring-forest-500/15 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] dark:bg-cream-50/10 dark:ring-cream-50/15"
      >
        <div className="space-y-3 bg-card px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="mt-2 h-3 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
          <Skeleton className="h-14 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-3 gap-px md:grid-cols-1">
          {["eftpos", "stripe", "flagged"].map((key) => (
            <div key={key} className="space-y-2 bg-card px-5 py-4 sm:px-6">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* Night by night */}
      <SkeletonCard className="overflow-hidden shadow-none">
        <div className="flex h-10 items-center gap-4 border-b bg-muted/50 px-4">
          <Skeleton className="h-3.5 w-24 flex-[2]" />
          {["cash", "eftpos", "stripe"].map((col) => (
            <div key={col} className="flex flex-1 justify-end">
              <Skeleton className="h-3.5 w-14" />
            </div>
          ))}
        </div>
        {ROWS.map((row) => (
          <div
            key={row}
            className="flex h-[41px] items-center gap-4 border-b px-4 last:border-0"
          >
            <Skeleton className="h-4 w-32 flex-[2]" />
            {["cash", "eftpos", "stripe"].map((col) => (
              <div key={col} className="flex flex-1 justify-end">
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ))}
      </SkeletonCard>
    </AdminPageSkeleton>
  );
}

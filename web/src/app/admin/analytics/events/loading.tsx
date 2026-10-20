import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["a", "b", "c", "d", "e", "f"];

export default function EventsCafeLoading() {
  return (
    <AdminPageSkeleton
      title="Events & Cafe"
      description="Fundraiser income and cafe takings, kept separate from koha"
      className="space-y-5"
    >
      {/* Controls */}
      <SkeletonCard className="flex flex-wrap items-center gap-2 p-3">
        <Skeleton className="h-8 w-[190px]" />
        <Skeleton className="h-8 w-[170px]" />
        <Skeleton className="h-9 w-[200px] rounded-lg sm:ml-auto" />
      </SkeletonCard>

      {/* Total */}
      <SkeletonCard className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-14 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
          {["a", "b", "c", "d", "e", "f"].map((k) => (
            <div key={k} className="space-y-2 py-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Breakdowns */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {["income", "paid", "expenses"].map((k) => (
          <SkeletonCard
            key={k}
            className={
              k === "expenses"
                ? "space-y-4 p-5 md:col-span-2 lg:col-span-1"
                : "space-y-4 p-5"
            }
          >
            <Skeleton className="h-4 w-32" />
            {["1", "2", "3"].map((r) => (
              <div key={r} className="space-y-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </SkeletonCard>
        ))}
      </div>

      {/* Table */}
      <SkeletonCard className="space-y-3 p-4">
        {ROWS.map((k) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </SkeletonCard>
    </AdminPageSkeleton>
  );
}

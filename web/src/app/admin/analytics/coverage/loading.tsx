import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const COLUMNS = ["shifts", "positions", "filled", "rate", "unfilled", "empty", "under", "critical"];

function CardTitleBar({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-2 px-6 pb-2">
      <Skeleton className="size-7 rounded-lg" />
      <Skeleton className={cn("h-4", width)} />
    </div>
  );
}

export default function ShiftCoverageLoading() {
  return (
    <AdminPageSkeleton
      title="Shift Coverage"
      description="Shifts run, positions filled, and understaffing by restaurant"
    >
      {/* Filters */}
      <SkeletonCard className="p-4">
        <div className="flex flex-col items-end gap-4 sm:flex-row">
          <div className="grid w-full flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
            {["period", "location"].map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <div className="flex flex-wrap gap-1">
                {DAYS.map((day) => (
                  <Skeleton key={day} className="h-9 w-[38px]" />
                ))}
              </div>
            </div>
          </div>
          <Skeleton className="h-9 w-full sm:w-28" />
        </div>
      </SkeletonCard>

      <div className="space-y-6">
        {/* Hero: fill rate + headline counts */}
        <SkeletonCard className="flex flex-col overflow-hidden py-6">
          <div className="flex flex-col md:flex-row">
            <div className="flex items-center gap-5 p-6">
              <Skeleton className="size-[72px] shrink-0 rounded-full" />
              <div className="space-y-2 pl-6">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2 divide-x border-t md:border-t-0 md:border-l">
              {["shifts", "positions"].map((key) => (
                <div
                  key={key}
                  className="flex flex-col items-center justify-center gap-1.5 p-5"
                >
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-7 w-14" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </SkeletonCard>

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["filled", "unfilled", "understaffed", "critical"].map((key) => (
            <SkeletonCard key={key} className="border-0">
              <div className="flex items-center gap-4 px-6 py-5">
                <Skeleton className="size-12 shrink-0 rounded-full" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-14" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>

        {/* Staffing by restaurant chart */}
        <SkeletonCard className="flex flex-col gap-6 py-6">
          <CardTitleBar width="w-40" />
          <div className="px-6">
            <Skeleton className="h-[220px] w-full rounded-lg bg-muted/40" />
          </div>
        </SkeletonCard>

        {/* Per-restaurant breakdown table */}
        <SkeletonCard className="flex flex-col gap-6 py-6">
          <CardTitleBar width="w-44" />
          <div className="overflow-x-auto px-6">
            <div className="min-w-[720px] text-sm">
              <div className="flex h-10 items-center gap-2 border-b px-2">
                <div className="flex-[1.6]">
                  <Skeleton className="h-3.5 w-20" />
                </div>
                {COLUMNS.map((col) => (
                  <div key={col} className="flex flex-1 justify-end">
                    <Skeleton className="h-3.5 w-14" />
                  </div>
                ))}
              </div>
              {["a", "b", "c", "total"].map((row) => (
                <div
                  key={row}
                  className="flex h-[37px] items-center gap-2 border-b px-2 last:border-0"
                >
                  <div className="flex-[1.6]">
                    <Skeleton className="h-4 w-28" />
                  </div>
                  {COLUMNS.map((col) => (
                    <div key={col} className="flex flex-1 justify-end">
                      <Skeleton className="h-4 w-8" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </SkeletonCard>
      </div>
    </AdminPageSkeleton>
  );
}

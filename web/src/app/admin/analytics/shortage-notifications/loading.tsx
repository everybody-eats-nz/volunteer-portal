import type { ReactNode } from "react";

import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RESTAURANT_COLUMNS = ["events", "delivered", "failed", "volunteers", "signups", "conversion"];
const CONVERTER_COLUMNS = ["alerts", "signups", "rate", "last"];
const CONVERTER_ROWS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Mirrors `ChartCard` from ../_components/primitives (rounded-xl chassis). */
function ChartCardSkeleton({
  titleWidth,
  action,
  children,
}: {
  titleWidth: string;
  /** Width class of the header action button. */
  action?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 shrink-0 rounded-lg" />
          <Skeleton className={cn("h-4", titleWidth)} />
        </div>
        {action && <Skeleton className={cn("h-8", action)} />}
      </div>
      <div className="flex-1 px-2 pb-3">{children}</div>
    </div>
  );
}

export default function ShortageNotificationsLoading() {
  return (
    <AdminPageSkeleton
      title="Shortage Notifications"
      description="Shift-shortage alerts sent to volunteers and the signups they drove, org-wide and by restaurant"
      className="space-y-4"
    >
      {/* Filters */}
      <div aria-hidden="true" className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            {["period", "location"].map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-full sm:w-28" />
        </div>
      </div>

      <div aria-hidden="true" className="space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {["sent", "volunteers", "signups", "conversion"].map((key) => (
            <div
              key={key}
              className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="size-7 rounded-lg" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="mt-3 h-[30px] w-20" />
              <div className="mt-2 flex min-h-5 items-center">
                <Skeleton className="h-3.5 w-32" />
              </div>
              <Skeleton className="mt-2 h-10 w-full bg-muted/40" />
            </div>
          ))}
        </div>

        {/* Secondary stat chips */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {["delivery", "failed", "per-alert", "restaurants"].map((key) => (
            <div
              key={key}
              className="flex h-full items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
            >
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        </div>

        {/* Trend over time */}
        <ChartCardSkeleton titleWidth="w-44">
          <Skeleton className="h-[300px] w-full rounded-lg bg-muted/40" />
        </ChartCardSkeleton>

        {/* Per-restaurant breakdown */}
        <ChartCardSkeleton titleWidth="w-44">
          <div className="overflow-x-auto px-2 pb-1">
            <div className="min-w-[600px]">
              <div className="flex h-10 items-center gap-2 border-b px-2">
                <div className="flex-[1.5]">
                  <Skeleton className="h-3.5 w-20" />
                </div>
                {RESTAURANT_COLUMNS.map((col) => (
                  <div key={col} className="flex flex-1 justify-end">
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                ))}
              </div>
              {["a", "b", "c", "total"].map((row) => (
                <div
                  key={row}
                  className="flex h-[37px] items-center gap-2 border-b px-2 last:border-0"
                >
                  <div className="flex-[1.5]">
                    <Skeleton className="h-4 w-28" />
                  </div>
                  {RESTAURANT_COLUMNS.map((col) => (
                    <div key={col} className="flex flex-1 justify-end">
                      <Skeleton className="h-4 w-8" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </ChartCardSkeleton>

        {/* Volunteers who convert */}
        <ChartCardSkeleton titleWidth="w-40" action="w-32">
          <div className="max-h-[440px] overflow-hidden px-2 pb-1">
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="flex h-10 items-center gap-2 border-b px-2">
                  <Skeleton className="size-4 shrink-0 rounded-[4px]" />
                  <div className="flex-[2]">
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                  <div className="flex-1">
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                  {CONVERTER_COLUMNS.map((col) => (
                    <div key={col} className="flex flex-1 justify-end">
                      <Skeleton className="h-3.5 w-14" />
                    </div>
                  ))}
                </div>
                {CONVERTER_ROWS.map((row) => (
                  <div
                    key={row}
                    className="flex items-center gap-2 border-b p-2 last:border-0"
                  >
                    <Skeleton className="size-4 shrink-0 rounded-[4px]" />
                    <div className="flex flex-[2] items-center gap-3">
                      <Skeleton className="size-8 shrink-0 rounded-full" />
                      <div className="min-w-0 space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Skeleton className="h-4 w-20" />
                    </div>
                    {CONVERTER_COLUMNS.map((col) => (
                      <div key={col} className="flex flex-1 justify-end">
                        <Skeleton className="h-4 w-10" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="px-3 pt-2">
            <Skeleton className="h-3 w-36" />
          </div>
        </ChartCardSkeleton>
      </div>
    </AdminPageSkeleton>
  );
}

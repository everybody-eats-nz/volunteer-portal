import type { ReactNode } from "react";

import {
  AdminPageSkeleton,
  TabsSkeleton,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Mirrors `ChartCard` from ./_components/primitives (rounded-xl chassis). */
function ChartCardSkeleton({
  titleWidth = "w-32",
  action,
  className,
  children,
}: {
  titleWidth?: string;
  action?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 shrink-0 rounded-lg" />
          <Skeleton className={cn("h-4", titleWidth)} />
        </div>
        {action && <Skeleton className={cn("h-[26px] rounded-lg", action)} />}
      </div>
      <div className="flex-1 px-2 pb-3">{children}</div>
    </div>
  );
}

/** Same surface as the ApexChart dynamic-import placeholder. */
function ChartPlot({ height = 300 }: { height?: number }) {
  return (
    <Skeleton className="w-full rounded-lg bg-muted/40" style={{ height }} />
  );
}

export default function RestaurantAnalyticsLoading() {
  return (
    <AdminPageSkeleton
      title="Restaurant Analytics"
      description="Guests served, koha, volunteers and service-night insights across all locations"
      className="space-y-4 pb-12"
    >
      {/* Filter bar */}
      <div
        aria-hidden="true"
        className="rounded-xl border bg-card shadow-md"
      >
        <div className="flex flex-col gap-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="mr-1 hidden h-3.5 w-16 sm:block" />
            <Skeleton className="h-[34px] w-64 rounded-lg" />
            <Skeleton className="h-8 w-36" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-8 w-[170px]" />
              <Skeleton className="h-8 w-9 sm:w-[5.5rem]" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
          <div className="flex items-center gap-2 border-t pt-3">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20" />
              <div className="flex gap-1">
                {DAYS.map((day) => (
                  <Skeleton key={day} className="h-[30px] w-[38px]" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* KPI hero */}
        <div aria-hidden="true" className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {["guests", "koha", "per-head", "new"].map((key) => (
              <div
                key={key}
                className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="size-7 rounded-lg" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="mt-3 h-[30px] w-28" />
                <Skeleton className="mt-2 h-5 w-32 rounded-full" />
                <Skeleton className="mt-2 h-10 w-full bg-muted/40" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {["avg", "non-paying", "takeaways", "vege"].map((key) => (
              <div
                key={key}
                className="flex h-full items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
              >
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs + Overview tab */}
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <TabsSkeleton
              className="h-10"
              tabs={["w-28", "w-40", "w-36", "w-24"]}
            />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ChartCardSkeleton titleWidth="w-28" action="w-36">
                  <ChartPlot />
                </ChartCardSkeleton>
              </div>
              <ChartCardSkeleton titleWidth="w-28">
                <ChartPlot />
              </ChartCardSkeleton>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ChartCardSkeleton titleWidth="w-24" action="w-32">
                  <ChartPlot />
                </ChartCardSkeleton>
              </div>
              <ChartCardSkeleton titleWidth="w-28">
                <div className="flex h-full flex-col justify-center gap-2 px-2 py-1">
                  {["guests", "avg", "koha"].map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                    >
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                      <div className="flex flex-col items-end space-y-1.5">
                        <Skeleton className="h-4 w-10" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              </ChartCardSkeleton>
            </div>

            <ChartCardSkeleton titleWidth="w-36">
              <ChartPlot height={260} />
            </ChartCardSkeleton>
          </div>
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

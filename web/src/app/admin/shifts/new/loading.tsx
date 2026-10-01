import type { ReactNode } from "react";

import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Template location groups in the "Which shifts" step (collapsed by default).
const TEMPLATE_GROUPS = ["w-24", "w-32", "w-28"];

/** Mirrors `PlannerSection`: step eyebrow, heading, description, body. */
function PlannerSectionSkeleton({
  titleWidth,
  children,
}: {
  titleWidth: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-hidden="true"
      className="rounded-2xl border border-border bg-card shadow-sm"
    >
      <header className="space-y-2 border-b border-border px-5 py-4 sm:px-6">
        <Skeleton className="h-3 w-12" />
        <Skeleton className={cn("h-5", titleWidth)} />
        <Skeleton className="h-4 w-96 max-w-full" />
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export default function CreateShiftsLoading() {
  return (
    <AdminPageSkeleton
      title="Create shifts"
      description="Plan whole weeks from templates, or add a one-off shift."
      className="space-y-2"
      actions={
        <Button variant="outline" size="sm" disabled>
          ← Back to shifts
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Pill tab strip: Weekly Schedule / Single Shift / Templates & Roles */}
        <div
          aria-hidden="true"
          className="inline-flex h-12 w-full items-center gap-1 rounded-full border border-border bg-card p-1 sm:w-fit"
        >
          <Skeleton className="h-10 min-w-0 flex-1 rounded-full sm:w-40 sm:flex-none" />
          <Skeleton className="h-10 min-w-0 flex-1 rounded-full bg-transparent sm:w-32 sm:flex-none" />
          <Skeleton className="h-10 min-w-0 flex-1 rounded-full bg-transparent sm:w-44 sm:flex-none" />
        </div>

        {/* Weekly planner (default tab): steps on the left, run sheet on the right */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-6">
            <PlannerSectionSkeleton titleWidth="w-16">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full rounded-xl sm:max-w-sm" />
                </div>
                <div>
                  <Skeleton className="h-4 w-32" />
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-[3.25rem] rounded-full" />
                    ))}
                  </div>
                </div>
              </div>
            </PlannerSectionSkeleton>

            <PlannerSectionSkeleton titleWidth="w-28">
              <div className="space-y-3">
                {TEMPLATE_GROUPS.map((width, i) => (
                  <div
                    key={i}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border py-1 pr-3 pl-3"
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-4" />
                      <Skeleton className={cn("h-4", width)} />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </PlannerSectionSkeleton>
          </div>

          {/* Run sheet */}
          <div
            aria-hidden="true"
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            <div className="space-y-3 border-b border-dashed border-border px-5 pt-4 pb-7">
              <Skeleton className="h-3 w-20" />
              <div className="flex items-end gap-2.5">
                <Skeleton className="h-14 w-10" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <div className="space-y-2.5 px-5 py-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="border-t border-dashed border-border px-5 py-4">
              <Skeleton className="h-12 w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

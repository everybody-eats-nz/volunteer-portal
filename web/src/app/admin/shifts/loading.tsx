import { Plus } from "lucide-react";

import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { ServiceNightReportSkeleton } from "@/components/service-night-report-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Volunteer rows per card, so the masonry columns end at uneven heights.
const DAY_SHIFTS = [3, 2, 4];
const EVENING_SHIFTS = [2, 3];

function ShiftCardSkeleton({ volunteers }: { volunteers: number }) {
  return (
    <SkeletonCard className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex flex-1 items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="h-8 w-14 rounded-md" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="space-y-2 px-4 py-3">
        <Skeleton className="h-9 w-full rounded-lg" />
        {Array.from({ length: volunteers }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border p-3">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 border-t px-4 py-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 flex-1" />
        </div>
      </div>
    </SkeletonCard>
  );
}

function ShiftSectionSkeleton({
  titleWidth,
  shifts,
}: {
  titleWidth: string;
  shifts: number[];
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className={cn("h-5", titleWidth)} />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {shifts.map((volunteers, i) => (
          <ShiftCardSkeleton key={i} volunteers={volunteers} />
        ))}
      </div>
    </section>
  );
}

export default function AdminShiftsLoading() {
  return (
    <AdminPageSkeleton
      title="Restaurant Schedule"
      className="space-y-2"
      actions={
        <Button size="sm" disabled>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Shift
        </Button>
      }
    >
      {/* Toolbar tray: date stepper + location, then quick actions */}
      <div
        aria-hidden="true"
        className="mb-8 flex flex-col gap-3 rounded-xl border bg-muted/40 p-2.5 shadow-sm 2xl:flex-row 2xl:items-center 2xl:justify-between"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-11 shrink-0 border bg-background" />
            <Skeleton className="h-11 min-w-0 flex-1 border bg-background sm:w-[240px] sm:flex-none" />
            <Skeleton className="size-11 shrink-0 border bg-background" />
          </div>
          <Skeleton className="h-11 w-full border bg-background sm:w-[190px]" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-11 w-24 border bg-background" />
          <Skeleton className="h-11 w-40 border bg-background" />
          <Skeleton className="h-11 w-32 border bg-background" />
          <span className="mx-0.5 hidden h-7 w-px self-center bg-border sm:block" />
          <Skeleton className="h-11 w-32 border bg-background" />
        </div>
      </div>

      {/* Service night report (collapsed) */}
      <ServiceNightReportSkeleton />

      <div className="space-y-8">
        <ShiftSectionSkeleton titleWidth="w-24" shifts={DAY_SHIFTS} />
        <ShiftSectionSkeleton titleWidth="w-32" shifts={EVENING_SHIFTS} />
      </div>
    </AdminPageSkeleton>
  );
}

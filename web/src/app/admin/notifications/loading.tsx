import {
  AdminPageSkeleton,
  SkeletonCard,
  SkeletonCardHeader,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function LabelledField({
  className,
  height = "h-9",
}: {
  className?: string;
  height?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-4 w-20" />
      <Skeleton className={cn("w-full", height)} />
    </div>
  );
}

export default function ShiftShortageNotificationsLoading() {
  return (
    <AdminPageSkeleton
      title="Shift Shortage Notifications"
      description="Send shift shortage notifications to volunteers"
      className="container mx-auto space-y-2 px-4 py-8"
    >
      {/* Send Notifications / Manage Groups / History */}
      <TabsSkeleton tabs={["w-36", "w-32", "w-20"]} />

      {/* Send tab (default) */}
      <div className="space-y-6">
        {/* Select shifts with shortage */}
        <SkeletonCard className="space-y-6 py-6">
          <SkeletonCardHeader titleWidth="w-56" />
          <div className="space-y-4 px-6">
            <div className="flex flex-wrap items-end gap-4">
              <LabelledField className="w-full sm:w-[240px]" height="h-11" />
              <LabelledField className="min-w-[200px] flex-1" height="h-11" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="divide-y rounded-lg border">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="size-4 shrink-0 rounded-[4px]" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-64 max-w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SkeletonCard>

        {/* Filter volunteers */}
        <SkeletonCard className="space-y-6 py-6">
          <SkeletonCardHeader titleWidth="w-36" />
          <div className="space-y-4 px-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <LabelledField />
              <LabelledField />
              <LabelledField />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded-[4px]" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded-[4px]" />
                <Skeleton className="h-4 w-44" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Skeleton className="h-4 w-44" />
              <div className="flex w-full gap-2 sm:w-auto">
                <Skeleton className="h-9 min-w-0 flex-1 sm:w-[200px] sm:flex-none" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          </div>
        </SkeletonCard>

        {/* Select recipients */}
        <SkeletonCard className="space-y-6 py-6">
          <SkeletonCardHeader titleWidth="w-40" />
          <div className="px-6">
            <div className="flex items-center gap-4 py-4">
              <Skeleton className="h-9 w-full max-w-sm" />
              <Skeleton className="ml-auto h-9 w-28" />
            </div>
            <TableSkeleton
              card={false}
              className="overflow-hidden rounded-lg border"
              rows={10}
              columns={["w-40", "w-20", "w-28", "w-32", "w-12", "w-16"]}
            />
            <div className="flex items-center justify-between py-4">
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        </SkeletonCard>

        {/* Send bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-4 w-64 max-w-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-10 w-44" />
          </div>
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

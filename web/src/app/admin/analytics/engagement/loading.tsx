import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const ROWS = ["a", "b", "c", "d", "e", "f", "g", "h"];

function CardTitleBar({
  width,
  icon = true,
  action,
}: {
  width: string;
  icon?: boolean;
  /** Width class of a right-aligned toggle or caption. */
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between px-6 pb-2">
      <div className="flex items-center gap-2">
        {icon && <Skeleton className="size-4 rounded" />}
        <Skeleton className={cn("h-4", width)} />
      </div>
      {action && <Skeleton className={cn("h-[30px]", action)} />}
    </div>
  );
}

export default function VolunteerEngagementLoading() {
  return (
    <AdminPageSkeleton
      title="Volunteer Engagement"
      description="Track volunteer activity levels, engagement trends, and retention metrics"
    >
      {/* Filters */}
      <SkeletonCard className="py-6">
        <div className="flex flex-col items-end gap-4 px-6 py-4 sm:flex-row">
          <div className="grid w-full flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
            {["period", "location"].map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <div className="flex gap-1">
                {DAYS.map((day) => (
                  <Skeleton key={day} className="h-[30px] w-[38px]" />
                ))}
              </div>
            </div>
          </div>
          <Skeleton className="h-9 w-full sm:w-28" />
        </div>
      </SkeletonCard>

      <div className="space-y-6">
        {/* Hero: engagement health */}
        <SkeletonCard className="overflow-hidden py-6">
          <div className="flex flex-col md:flex-row">
            <div className="flex items-center gap-5 p-6">
              <Skeleton className="size-[72px] shrink-0 rounded-full" />
              <div className="space-y-2 pl-6">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2 divide-x sm:grid-cols-4">
              {["total", "retention", "new", "reactivated"].map((key) => (
                <div
                  key={key}
                  className="flex flex-col items-center justify-center gap-1.5 p-5"
                >
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-7 w-12" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        </SkeletonCard>

        {/* Category stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["highly-active", "active", "inactive", "never"].map((key) => (
            <SkeletonCard key={key} className="border-0 py-6">
              <div className="flex items-center gap-4 px-6 py-5">
                <Skeleton className="size-[52px] shrink-0 rounded-full" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-12" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonCard className="flex h-full flex-col gap-6 py-6">
            <CardTitleBar width="w-44" icon={false} action="w-48" />
            <div className="px-6">
              <Skeleton className="h-[280px] w-full rounded-lg bg-muted/40" />
              <div className="mt-2 grid grid-cols-4 gap-2 border-t pt-3">
                {["highly-active", "active", "inactive", "never"].map((key) => (
                  <div key={key} className="flex flex-col items-center gap-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3.5 w-8" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </div>
          </SkeletonCard>
          <SkeletonCard className="flex h-full flex-col gap-6 py-6">
            <CardTitleBar width="w-44" action="w-36" />
            <div className="px-6">
              <Skeleton className="h-[320px] w-full rounded-lg bg-muted/40" />
            </div>
          </SkeletonCard>
        </div>

        {/* Retention heatmap */}
        <SkeletonCard className="flex flex-col gap-6 py-6">
          <div className="flex items-center justify-between px-6 pb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="px-6">
            <Skeleton className="h-[432px] w-full rounded-lg bg-muted/40" />
          </div>
        </SkeletonCard>

        {/* Volunteer table */}
        <SkeletonCard className="flex flex-col gap-6 py-6">
          <div className="flex items-center gap-2 px-6">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-4 px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 w-[4.5rem]" />
              </div>
              <Skeleton className="h-11 w-[180px]" />
            </div>

            <div className="overflow-hidden rounded-md border">
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="flex items-center gap-4 border-b px-4 py-3">
                    <div className="shrink-0 basis-64">
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                    <Skeleton className="h-3.5 w-12" />
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3.5 w-20" />
                    <div className="w-20">
                      <Skeleton className="h-3.5 w-14" />
                    </div>
                  </div>
                  {ROWS.map((row) => (
                    <div
                      key={row}
                      className="flex items-center gap-4 border-b px-4 py-3 last:border-0"
                    >
                      <div className="flex shrink-0 basis-64 items-center gap-3">
                        <Skeleton className="size-8 shrink-0 rounded-full" />
                        <div className="min-w-0 space-y-1.5">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-12 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-8 w-28" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-14" />
              </div>
            </div>
          </div>
        </SkeletonCard>
      </div>
    </AdminPageSkeleton>
  );
}

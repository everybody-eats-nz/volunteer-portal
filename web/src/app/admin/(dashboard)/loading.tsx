import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Card shell matching `<Card>` + `<CardHeader><CardTitle>` + `<CardContent>`. */
function DashboardCard({
  titleWidth,
  children,
}: {
  titleWidth: string;
  children: React.ReactNode;
}) {
  return (
    <SkeletonCard className="flex flex-col gap-6 py-6">
      <div className="px-6">
        <Skeleton className={`h-5 ${titleWidth}`} />
      </div>
      <div className="px-6">{children}</div>
    </SkeletonCard>
  );
}

/** Skeleton for just the dashboard content (used as Suspense fallback) */
export function AdminDashboardContentSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats grid - mirrors AdminDashboardStats */}
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="self-start p-4">
            <div className="flex items-center justify-between">
              {/* Line boxes match text-2xl / text-sm / text-xs rows */}
              <div>
                <div className="flex h-8 items-center">
                  <Skeleton className="h-6 w-14" />
                </div>
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-28" />
                </div>
                <div className="mt-1 flex h-4 items-center">
                  <Skeleton className="h-3 w-32" />
                </div>
                {i === 3 && (
                  <div className="flex h-4 items-center">
                    <Skeleton className="h-3 w-24" />
                  </div>
                )}
              </div>
              <Skeleton className="size-9 rounded-lg" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      {/* Needs Attention + This Week */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <DashboardCard titleWidth="w-36">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Skeleton className="size-5 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
              </div>
            ))}
            <Skeleton className="mt-1 h-8 w-full" />
          </div>
        </DashboardCard>

        <DashboardCard titleWidth="w-24">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg p-2">
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="ml-auto h-4 w-8" />
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      {/* Upcoming Shifts + Quick Actions */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <DashboardCard titleWidth="w-36">
          <div className="space-y-4">
            {[3, 2, 2].map((shiftCount, day) => (
              <div key={day} className="border-b pb-4">
                <div className="mb-2 flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="mb-2 h-1.5 w-full rounded-full" />
                <div className="space-y-1">
                  {Array.from({ length: shiftCount }).map((_, s) => (
                    <div
                      key={s}
                      className="flex items-center justify-between gap-2 px-2 py-1"
                    >
                      <Skeleton className="h-3.5 w-48 max-w-full" />
                      <Skeleton className="h-3.5 w-8" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Skeleton className="h-8 w-full" />
          </div>
        </DashboardCard>

        <DashboardCard titleWidth="w-28">
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1.5 rounded-md border px-4 py-3 ${
                  i === 0 ? "col-span-2" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4 shrink-0 rounded" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="ml-6 hidden h-3 w-28 max-w-[70%] sm:block" />
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>

      {/* Recent Activity */}
      <DashboardCard titleWidth="w-32">
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
            >
              <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
              <div className="flex shrink-0 items-center gap-3 pt-0.5">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="hidden h-3 w-[70px] sm:block" />
              </div>
            </div>
          ))}
        </div>
      </DashboardCard>
    </div>
  );
}

/** Full-page loading skeleton (used by Next.js route-level loading) */
export default function AdminDashboardLoading() {
  return (
    <AdminPageSkeleton
      title="Admin Dashboard"
      description="Overview of volunteer portal activity and management tools."
    >
      {/* Location filter - mirrors LocationFilterTabs */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-[180px]" />
      </div>

      <AdminDashboardContentSkeleton />
    </AdminPageSkeleton>
  );
}

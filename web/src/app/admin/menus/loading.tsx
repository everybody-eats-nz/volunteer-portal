import {
  AdminPageSkeleton,
  SkeletonCard,
  SkeletonCardHeader,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Badge widths for the location column, so rows do not look stamped out.
const RECENT_LOCATIONS = ["w-20", "w-28", "w-24", "w-20", "w-32", "w-24", "w-28", "w-20"];

export default function DailyMenusLoading() {
  return (
    <AdminPageSkeleton
      title="Daily Menus"
      description="Set the menu for each restaurant location each day. Published to the website automatically."
    >
      {/* Select date & location */}
      <SkeletonCard className="space-y-6 py-6">
        <SkeletonCardHeader titleWidth="w-48" />
        <div className="flex flex-col gap-4 px-6 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </SkeletonCard>

      {/* Recent menus */}
      <SkeletonCard className="space-y-6 py-6">
        <SkeletonCardHeader titleWidth="w-32" />
        <div className="divide-y divide-border/50">
          {RECENT_LOCATIONS.map((width, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className={`h-5 ${width}`} />
                {i % 3 !== 2 && <Skeleton className="h-3 w-20" />}
              </div>
              <Skeleton className="h-3 w-32 shrink-0" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </AdminPageSkeleton>
  );
}

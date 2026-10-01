import {
  AdminPageSkeleton,
  SkeletonCard,
  SkeletonCardHeader,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function SiteSettingsLoading() {
  return (
    <AdminPageSkeleton
      title="Site Settings"
      description="Configure site-wide settings and URLs"
    >
      <SkeletonCard className="py-5">
        <div className="flex items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-5 shrink-0 rounded" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
          </div>
          <Skeleton className="size-4 shrink-0 rounded" />
        </div>
      </SkeletonCard>

      <SkeletonCard className="flex flex-col gap-6 py-6">
        <SkeletonCardHeader titleWidth="w-36" />
        <div className="space-y-6 px-6">
          {["w-48", "w-56"].map((width, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className={`h-4 ${width}`} />
              <div className="flex gap-2">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-8 w-9" />
                <Skeleton className="h-8 w-10" />
              </div>
              <Skeleton className="h-3 w-44" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </AdminPageSkeleton>
  );
}

import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ShiftApplicationsLoading() {
  return (
    <AdminPageSkeleton
      title="Shift Applications"
      description="How quickly shift applications are answered, and how many are declined, by restaurant"
    >
      <SkeletonCard className="p-4">
        <div className="flex flex-col items-end gap-4 sm:flex-row">
          <div className="grid w-full flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            {["period", "location"].map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-full sm:w-28" />
        </div>
      </SkeletonCard>

      <SkeletonCard className="h-[124px]" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["a", "b", "c", "d"].map((key) => (
          <SkeletonCard key={key} className="h-[98px]" />
        ))}
      </div>

      <SkeletonCard className="h-[220px]" />
      <SkeletonCard className="h-[300px]" />
    </AdminPageSkeleton>
  );
}

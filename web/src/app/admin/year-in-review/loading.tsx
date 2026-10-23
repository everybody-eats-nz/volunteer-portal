import {
  AdminPageSkeleton,
  SkeletonCard,
  SkeletonCardHeader,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function YearInReviewAdminLoading() {
  return (
    <AdminPageSkeleton
      title="Year in mahi"
      description="A video of each person's year at Everybody Eats, made to share on Instagram"
    >
      <SkeletonCard className="flex flex-col gap-6 py-6">
        <SkeletonCardHeader titleWidth="w-40" />
        <div className="space-y-4 px-6">
          <Skeleton className="h-6 w-72 max-w-full" />
          <Skeleton className="h-9 w-40" />
        </div>
      </SkeletonCard>
      <SkeletonCard className="flex flex-col gap-6 py-6">
        <SkeletonCardHeader titleWidth="w-56" />
        <div className="px-6">
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
      </SkeletonCard>
    </AdminPageSkeleton>
  );
}

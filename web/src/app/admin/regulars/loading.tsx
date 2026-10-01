import {
  AdminPageSkeleton,
  SkeletonCard,
  SkeletonCardHeader,
  TableSkeleton,
} from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function RegularsLoading() {
  return (
    <AdminPageSkeleton
      title="Regular Volunteers"
      description="Manage volunteers with recurring shift assignments"
      actions={
        <Button variant="outline" size="sm" disabled>
          ← Back to admin
        </Button>
      }
      className="space-y-8"
    >
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-12" />
              </div>
              <Skeleton className="size-9 shrink-0 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Collapsed "Add Regular Volunteer" card */}
      <SkeletonCard className="py-6">
        <SkeletonCardHeader
          titleWidth="w-48"
          action="w-32"
          className="items-center"
        />
      </SkeletonCard>

      {/* Regulars table with toolbar */}
      <div className="bg-card rounded-lg border shadow-sm" aria-hidden="true">
        <div className="border-b p-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-8 w-52" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-[180px]" />
              </div>
            </div>
          </div>
        </div>
        <TableSkeleton
          card={false}
          rows={8}
          columns={["w-36", "w-20", "w-24", "w-20", "w-24", "w-16", "w-10"]}
          actions
        />
      </div>
    </AdminPageSkeleton>
  );
}

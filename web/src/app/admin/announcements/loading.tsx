import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

function AnnouncementRowSkeleton({ chips }: { chips: number }) {
  return (
    <SkeletonCard>
      <div className="flex items-start gap-4 p-4">
        <Skeleton className="h-[50px] w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-5 w-56 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Skeleton className="size-8" />
              <Skeleton className="size-8" />
            </div>
          </div>
          <Skeleton className="mt-2 h-3 w-48 max-w-full" />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {Array.from({ length: chips }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-16 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonCard>
  );
}

export default function AnnouncementsLoading() {
  return (
    <AdminPageSkeleton
      title="Announcements"
      description="Send targeted announcements to volunteers in the mobile feed"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-9 w-44 rounded-full" />
        </div>

        <div className="space-y-6">
          <SkeletonCard className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 px-5 py-4">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-6 w-14" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </SkeletonCard>

          <Skeleton className="h-9 w-full max-w-xs" />

          <section>
            <Skeleton className="mb-2.5 ml-1 h-3 w-36" />
            <div className="space-y-3">
              {[3, 2, 3].map((chips, i) => (
                <AnnouncementRowSkeleton key={i} chips={chips} />
              ))}
            </div>
          </section>

          <section>
            <Skeleton className="mb-2.5 ml-1 h-3 w-24" />
            <div className="space-y-2">
              {[2, 2, 1].map((chips, i) => (
                <AnnouncementRowSkeleton key={i} chips={chips} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

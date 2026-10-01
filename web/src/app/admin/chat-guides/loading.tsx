import { ScrollText } from "lucide-react";

import {
  AdminPageSkeleton,
  SkeletonCard,
  SkeletonCardHeader,
} from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function ChatGuidesLoading() {
  return (
    <AdminPageSkeleton
      title="Chat Guides"
      description="Manage which resources are included as context for the mobile AI chat assistant. Volunteers can ask the assistant questions and it will answer based on these resources."
      actions={
        <Button variant="outline" disabled>
          <ScrollText className="mr-2 h-4 w-4" />
          View Logs
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {[false, true, false].map((meter, i) => (
          <SkeletonCard key={i} className="flex flex-col gap-6 py-6">
            <div className="px-6">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="px-6">
              <Skeleton className="h-9 w-16" />
              {meter && (
                <>
                  <Skeleton className="mt-2 h-2 w-full rounded-full" />
                  <Skeleton className="mt-1 h-3 w-36" />
                </>
              )}
            </div>
          </SkeletonCard>
        ))}
      </div>

      <SkeletonCard className="space-y-2 rounded-lg p-4 shadow-none">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </SkeletonCard>

      <SkeletonCard className="flex flex-col gap-6 py-6">
        <SkeletonCardHeader titleWidth="w-24" />
        <div className="space-y-3 px-6">
          <Skeleton className="h-9 w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-3 w-20" />
            {["w-48", "w-44", "w-28", "w-40"].map((width, i) => (
              <Skeleton key={i} className={`h-7 ${width}`} />
            ))}
          </div>
        </div>
      </SkeletonCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonCard className="flex flex-col gap-6 py-6">
          <SkeletonCardHeader titleWidth="w-32" />
          <div className="px-6">
            <Skeleton className="h-[218px] w-full" />
          </div>
        </SkeletonCard>
        <SkeletonCard className="flex flex-col gap-6 py-6">
          <SkeletonCardHeader titleWidth="w-40" action="w-16" />
          <div className="space-y-3 px-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="size-9 shrink-0" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-9 w-44" />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-52" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="py-6">
              <div className="flex items-start gap-4 p-4">
                <Skeleton className="size-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-48 max-w-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex shrink-0 gap-1">
                  <Skeleton className="size-9" />
                  <Skeleton className="size-9" />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

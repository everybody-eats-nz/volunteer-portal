import { Plus } from "lucide-react";

import { SkeletonCard } from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Shared by the route `loading.tsx` and the client's initial fetch state. */
export function NewsletterListsSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-[34rem] max-w-full" />
        <Button disabled className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Add Newsletter List
        </Button>
      </div>

      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="py-6">
            <div className="flex flex-col gap-3 px-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Skeleton className="mt-1 size-5 shrink-0 rounded" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="mt-2 h-4 w-72 max-w-full" />
                  <Skeleton className="mt-2 h-3 w-56 max-w-full" />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="size-8" />
                <Skeleton className="size-8" />
              </div>
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

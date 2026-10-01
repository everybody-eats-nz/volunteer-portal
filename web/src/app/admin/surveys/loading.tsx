import { Plus } from "lucide-react";

import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const TRIGGER_CHIP_WIDTHS = ["w-24", "w-32", "w-36", "w-24", "w-20"];
const SURVEY_TITLE_WIDTHS = ["w-48", "w-40", "w-56", "w-44"];

export default function SurveysLoading() {
  return (
    <AdminPageSkeleton
      title="Surveys"
      description="Design, deploy and track volunteer feedback across the motu."
      actions={
        <Button size="sm" disabled>
          <Plus className="mr-2 h-4 w-4" />
          Create survey
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard
            key={i}
            className="flex flex-col gap-3 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-28" />
          </SkeletonCard>
        ))}
      </div>

      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-[34px] w-52 rounded-lg" />
          <div className="flex flex-wrap items-center gap-1">
            {TRIGGER_CHIP_WIDTHS.map((width, i) => (
              <Skeleton key={i} className={`h-[26px] rounded-full ${width}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {SURVEY_TITLE_WIDTHS.map((width, i) => (
          <SkeletonCard key={i} className="overflow-hidden rounded-xl">
            <div className="flex flex-col gap-4 p-5 pl-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className={`h-5 max-w-full ${width}`} />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="mt-2 h-4 w-40" />
                </div>
                <Skeleton className="size-8 shrink-0" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/5" />
              </div>
              <div className="bg-muted/40 flex items-center gap-4 rounded-lg p-3">
                <Skeleton className="size-[72px] shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="flex gap-3 pt-0.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-8 w-36" />
              </div>
            </div>
          </SkeletonCard>
        ))}
      </div>
    </AdminPageSkeleton>
  );
}

import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "registered", bar: "w-full" },
  { key: "profile", bar: "w-4/5" },
  { key: "signed-up", bar: "w-3/5" },
  { key: "first-shift", bar: "w-2/5" },
];

function CardTitleBar({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-2 px-6 pb-2">
      <Skeleton className="size-7 rounded-lg" />
      <Skeleton className={cn("h-4", width)} />
    </div>
  );
}

export default function VolunteerRecruitmentLoading() {
  return (
    <AdminPageSkeleton
      title="Volunteer Recruitment"
      description="New registrations, onboarding conversion, and time-to-first-shift metrics"
    >
      {/* Filters */}
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

      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["registrations", "conversion", "time-to-first", "completed"].map(
            (key) => (
              <SkeletonCard key={key} className="border-0">
                <div className="flex items-center gap-4 px-6 py-5">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-14" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              </SkeletonCard>
            )
          )}
        </div>

        {/* New registrations + onboarding funnel */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonCard className="flex h-full flex-col gap-6 py-6">
            <CardTitleBar width="w-36" />
            <div className="px-6">
              <Skeleton className="h-[320px] w-full rounded-lg bg-muted/40" />
            </div>
          </SkeletonCard>

          <SkeletonCard className="flex h-full flex-col gap-6 py-6">
            <CardTitleBar width="w-36" />
            <div className="space-y-4 px-6 py-2">
              <div className="flex flex-wrap gap-3 pb-1">
                {["a", "b", "c"].map((loc) => (
                  <div key={loc} className="flex items-center gap-1.5">
                    <Skeleton className="size-2.5 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
              {STAGES.map((stage, i) => (
                <div key={stage.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-36" />
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3 w-10" />
                      <Skeleton className="h-4 w-9" />
                    </div>
                  </div>
                  <div className="h-5 overflow-hidden rounded bg-muted/30">
                    <Skeleton className={cn("h-full rounded", stage.bar)} />
                  </div>
                  {i > 0 && <Skeleton className="ml-4 h-3 w-32" />}
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>

        {/* Time to first shift distribution */}
        <SkeletonCard className="flex flex-col gap-6 py-6">
          <CardTitleBar width="w-60" />
          <div className="px-6">
            <Skeleton className="h-[300px] w-full rounded-lg bg-muted/40" />
          </div>
        </SkeletonCard>
      </div>
    </AdminPageSkeleton>
  );
}

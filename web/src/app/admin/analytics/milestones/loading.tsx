import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const THRESHOLDS = [10, 25, 50, 100, 200, 500];
const ROWS = ["a", "b", "c", "d", "e", "f"];

function CardTitleBar({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="size-7 rounded-lg" />
      <Skeleton className={cn("h-4", width)} />
    </div>
  );
}

/** Chart card: `CardHeader pb-2` title plus a 300px plot. */
function ChartCard({ titleWidth }: { titleWidth: string }) {
  return (
    <SkeletonCard className="flex h-full flex-col gap-6 py-6">
      <div className="px-6 pb-2">
        <CardTitleBar width={titleWidth} />
      </div>
      <div className="px-6">
        <Skeleton className="h-[300px] w-full rounded-lg bg-muted/40" />
      </div>
    </SkeletonCard>
  );
}

/** List card with a "Milestone:" select in the header and column headings. */
function ListCard({
  titleWidth,
  columns,
  progress,
  rowGap,
}: {
  titleWidth: string;
  /** Width classes of the fixed trailing columns. */
  columns: string[];
  /** Show the progress bar under each volunteer name. */
  progress: boolean;
  rowGap: string;
}) {
  // The milestone badge column (recent achievements) is left-aligned.
  const leftAligned = (i: number) => !progress && i === 0;
  return (
    <SkeletonCard className="flex flex-col gap-6 py-6">
      <div className="flex flex-col justify-between gap-3 px-6 pb-4 sm:flex-row sm:items-center">
        <CardTitleBar width={titleWidth} />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-11 w-36" />
        </div>
      </div>
      <div className={cn("px-6", rowGap)}>
        <div className="flex items-center gap-3 pb-1 sm:gap-4">
          <div className="flex-1">
            <Skeleton className="h-3 w-16" />
          </div>
          {columns.map((width, i) => (
            <div
              key={i}
              className={cn("flex", leftAligned(i) ? "justify-start" : "justify-end", width)}
            >
              {width !== "w-8" && <Skeleton className="h-3 w-14" />}
            </div>
          ))}
        </div>
        {ROWS.map((row) => (
          <div
            key={row}
            className="flex items-center gap-3 border-b py-2 last:border-0 sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              {progress && <Skeleton className="mt-1 h-1.5 w-full rounded-full" />}
            </div>
            {columns.map((width, i) => (
              <div
                key={i}
                className={cn("flex", leftAligned(i) ? "justify-start" : "justify-end", width)}
              >
                {width === "w-8" ? (
                  <Skeleton className="size-3.5" />
                ) : (
                  <Skeleton
                    className={cn("h-4", leftAligned(i) ? "w-20 rounded-full" : "w-10")}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}

export default function MilestoneAnalyticsLoading() {
  return (
    <AdminPageSkeleton
      title="Milestone Analytics"
      description="Track when volunteers hit key shift milestones and project future recognition opportunities"
    >
      {/* Filters */}
      <SkeletonCard className="p-4">
        <div className="flex flex-col items-end gap-4 sm:flex-row">
          <div className="grid w-full flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            {["period", "location"].map((key) => (
              <div key={key} className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-full sm:w-28" />
        </div>
      </SkeletonCard>

      <div className="space-y-6">
        {/* Milestone summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {THRESHOLDS.map((threshold) => (
            <SkeletonCard key={threshold} className="overflow-hidden">
              <div className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-9 w-12" />
                <Skeleton className="mt-1 h-3 w-24 max-w-full" />
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-6" />
                </div>
              </div>
            </SkeletonCard>
          ))}
        </div>

        {/* Milestones hit + volunteer distribution */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCard titleWidth="w-32" />
          <ChartCard titleWidth="w-44" />
        </div>

        {/* 12-month projections */}
        <ChartCard titleWidth="w-56" />

        <ListCard
          titleWidth="w-44"
          columns={["w-14 sm:w-24", "hidden sm:flex w-24", "hidden sm:flex w-28", "w-20 sm:w-28", "w-8"]}
          progress
          rowGap="space-y-3"
        />

        <ListCard
          titleWidth="w-56"
          columns={["w-28", "hidden sm:flex w-20", "w-24 sm:w-32", "w-8"]}
          progress={false}
          rowGap="space-y-2"
        />
      </div>
    </AdminPageSkeleton>
  );
}

import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** One 13px line of muted copy (line box ~20px). */
function Line({ width, className }: { width: string; className?: string }) {
  return (
    <div className={cn("flex h-5 items-center", className)}>
      <Skeleton className={cn("h-3.5 max-w-full", width)} />
    </div>
  );
}

function SectionSkeleton({
  titleWidth,
  cards,
  approved = false,
}: {
  titleWidth: string;
  cards: number;
  approved?: boolean;
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5 pb-2">
        <Skeleton className={cn("h-4", titleWidth)} />
        <Skeleton className="h-3.5 w-4" />
      </div>
      <ul className="space-y-2">
        {Array.from({ length: cards }).map((_, i) => (
          <li key={i}>
            <SkeletonCard className="flex flex-wrap items-start gap-4 p-4">
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className={cn("h-4", i % 2 ? "w-32" : "w-40")} />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
                <Line width={i % 2 ? "w-56" : "w-64"} className="mt-1" />
                <Line width="w-72" className="mt-1" />
                {approved && <Line width="w-52" className="mt-1" />}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {approved ? (
                  <>
                    <Skeleton className="h-8 w-28 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                  </>
                ) : (
                  <>
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-8 w-20 rounded-full" />
                  </>
                )}
              </div>
            </SkeletonCard>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function VanDriversLoading() {
  return (
    <AdminPageSkeleton
      title="Van drivers"
      description="Only approved drivers can take a van out. Driving is a capability rather than a role, so approving somebody here does not change anything else about their account."
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-prose space-y-1.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <Skeleton className="h-9 w-36 shrink-0 rounded-full" />
      </div>

      <SectionSkeleton titleWidth="w-40" cards={1} />
      <SectionSkeleton titleWidth="w-36" cards={5} approved />
    </AdminPageSkeleton>
  );
}

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

const GROUPS = [
  { titleWidth: "w-44", items: 3 },
  { titleWidth: "w-36", items: 2 },
];

export default function VanExceptionsLoading() {
  return (
    <AdminPageSkeleton
      title="Van exceptions"
      description="Worked out from the trips every time this page loads, never stored. Fix the underlying trip and the entry disappears on its own."
      className="space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>

      <div className="space-y-6">
        {GROUPS.map((group, g) => (
          <section key={g}>
            <div className="flex items-center gap-2.5">
              <Skeleton className={cn("h-4", group.titleWidth)} />
              <Skeleton className="h-3.5 w-4" />
            </div>
            <div className="mt-0.5 max-w-2xl">
              <Line width="w-full" />
            </div>

            <ul className="mt-2.5 space-y-2">
              {Array.from({ length: group.items }).map((_, i) => (
                // Real cards keep Card's py-6 around a p-4 body.
                <li key={i}>
                  <SkeletonCard className="py-6">
                    <div className="flex flex-wrap items-start gap-3 p-4">
                      <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <Skeleton className="my-0.5 h-4 w-56 max-w-full" />
                        <Line width={i % 2 ? "w-80" : "w-96"} className="mt-1" />
                        <Line width="w-[28rem]" className="mt-2" />
                        {g === 0 && i === 0 && (
                          <Line width="w-48" className="mt-1" />
                        )}
                      </div>
                      <Skeleton className="h-[30px] w-14 shrink-0 rounded-lg" />
                    </div>
                  </SkeletonCard>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AdminPageSkeleton>
  );
}

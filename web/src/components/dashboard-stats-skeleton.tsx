import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the editorial StatBand so the streamed-in stats don't shift layout. */
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-forest-500/10 ring-1 ring-forest-500/10 lg:grid-cols-4 dark:bg-cream-50/10 dark:ring-cream-50/10">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-background px-5 py-6 sm:px-8 sm:py-8">
          <Skeleton className="h-10 w-16 sm:h-12" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

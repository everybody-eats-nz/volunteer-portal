import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Suspense fallback for <ShiftsCalendarSection>. Mirrors the calendar's month
 * header (forest icon tile + month + nav) and day grid so the calendar view
 * gets its own loading state once a location is chosen — distinct from the
 * /shifts location-selection skeleton in loading.tsx.
 */
export function ShiftsCalendarSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Skeleton className="h-8 w-8 rounded-xl sm:h-10 sm:w-10" />
          <div>
            <Skeleton className="mb-1 h-7 w-36" />
            <Skeleton className="hidden h-4 w-56 sm:block" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-9 rounded-full" />
          <Skeleton className="h-8 w-9 rounded-full" />
        </div>
      </div>

      {/* Calendar card */}
      <Card className="rounded-3xl border-forest-500/10 dark:border-cream-50/10">
        <CardContent className="p-2 sm:p-6">
          {/* Days of week */}
          <div className="mb-2 grid grid-cols-7 gap-1 sm:mb-4 sm:gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="mx-auto h-4 w-6" />
            ))}
          </div>
          {/* Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

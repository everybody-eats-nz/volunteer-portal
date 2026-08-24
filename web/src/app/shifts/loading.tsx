import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading fallback for the /shifts segment. The route's landing view is the
 * location-selection screen (a centered hero + a list of location cards), so
 * the skeleton mirrors that rather than the calendar — the calendar is only
 * reached once a location is chosen.
 */
export default function ShiftsLoading() {
  return (
    <PageContainer>
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center py-10 text-center sm:py-16">
        {/* Eyebrow */}
        <Skeleton className="mb-6 h-3 w-56" />
        {/* Icon tile */}
        <Skeleton className="mb-6 h-16 w-16 rounded-2xl" />
        {/* Heading */}
        <Skeleton className="mb-4 h-11 w-72 max-w-full sm:h-12" />
        {/* Description */}
        <Skeleton className="h-5 w-80 max-w-full" />

        {/* Location cards */}
        <div className="mt-10 w-full space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

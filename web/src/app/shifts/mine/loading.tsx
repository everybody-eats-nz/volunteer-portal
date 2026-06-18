import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { MyShiftsContentSkeleton } from "./my-shifts-skeleton";

/** Route-level loading state for /shifts/mine — without this, navigation
    falls back to the /shifts segment's calendar-grid skeleton. */
export default function MyShiftsLoading() {
  return (
    <PageContainer>
      {/* Header skeleton — eyebrow + display heading + description */}
      <div className="pb-4">
        <Skeleton className="mb-4 h-3 w-48" />
        <Skeleton className="h-11 w-56 sm:h-13 sm:w-72" />
        <Skeleton className="mt-4 h-5 w-72 max-w-full" />
      </div>

      <MyShiftsContentSkeleton />
    </PageContainer>
  );
}

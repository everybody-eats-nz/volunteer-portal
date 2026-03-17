import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { MyShiftsContentSkeleton } from "./my-shifts-skeleton";

export default function MyShiftsLoading() {
  return (
    <PageContainer>
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="flex-1">
          <Skeleton className="h-10 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <MyShiftsContentSkeleton />
    </PageContainer>
  );
}

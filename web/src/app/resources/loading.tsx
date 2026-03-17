import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ResourcesLoading() {
  return (
    <PageContainer>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <Skeleton className="h-10 w-40 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Search/filter bar */}
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Results count */}
        <Skeleton className="h-5 w-40" />

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

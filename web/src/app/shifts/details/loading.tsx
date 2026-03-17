import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ShiftDetailsLoading() {
  return (
    <PageContainer>
      {/* Navigation row */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-9 w-36" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Date header */}
      <div className="mb-8">
        <Skeleton className="h-10 w-72 mb-2" />
        <Skeleton className="h-5 w-48" />
      </div>

      {/* Shift cards skeleton */}
      <div className="space-y-8">
        {/* Time period header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div>
              <Skeleton className="h-6 w-32 mb-1" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="w-10 h-10 rounded-xl" />
                      <div className="flex-1">
                        <Skeleton className="h-6 w-40 mb-2" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-16 rounded-lg" />
                      <Skeleton className="h-16 rounded-lg" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

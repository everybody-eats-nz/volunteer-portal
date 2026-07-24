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

      {/* Date header — eyebrow + display heading + location badge */}
      <div className="mb-8">
        <Skeleton className="mb-4 h-3 w-44" />
        <Skeleton className="mb-3 h-11 w-80 max-w-full sm:h-12" />
        <Skeleton className="h-5 w-40" />
      </div>

      {/* Shift cards skeleton */}
      <div className="space-y-8">
        {/* Time period header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <div>
              <Skeleton className="h-6 w-32 mb-1" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                className="overflow-hidden rounded-3xl border-forest-500/10 dark:border-cream-50/10"
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="w-11 h-11 rounded-2xl" />
                      <div className="flex-1">
                        <Skeleton className="h-6 w-40 mb-2" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-16 rounded-xl" />
                      <Skeleton className="h-16 rounded-xl" />
                    </div>
                    <Skeleton className="h-10 w-full rounded-full" />
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

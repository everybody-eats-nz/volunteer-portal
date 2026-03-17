import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ShiftDetailLoading() {
  return (
    <PageContainer>
      {/* Back button */}
      <div className="mb-6">
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Shift title */}
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Main card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-7 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-6 w-28" />
              </div>
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Action button */}
          <Skeleton className="h-10 w-full sm:w-48" />

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>

          {/* Volunteers */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-10 rounded-full border-2 border-background" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

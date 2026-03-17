import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function MyShiftsContentSkeleton() {
  return (
    <>
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-10 w-10 bg-muted animate-pulse rounded-xl" />
            </div>
          </Card>
        ))}
      </div>

      {/* Calendar skeleton */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-muted animate-pulse rounded-lg" />
              <div className="space-y-2">
                <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-40 bg-muted animate-pulse rounded" />
              </div>
            </div>
            <div className="hidden sm:flex gap-2">
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="hidden sm:grid grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-6 bg-muted animate-pulse rounded" />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[140px] bg-muted/50 animate-pulse rounded-xl border border-gray-200/40"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

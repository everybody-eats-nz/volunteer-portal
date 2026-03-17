import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ProfileEditLoading() {
  return (
    <div className="min-h-screen">
      <PageContainer className="space-y-8">
        {/* Page header: title, description, back button */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-9 w-36 mt-2" />
        </div>

        {/* Progress indicator section */}
        <div className="rounded-xl border border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>

          {/* Step circles with connecting lines (hidden on mobile) */}
          <div className="hidden md:flex items-center space-x-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className={`flex items-center ${i === 6 ? "grow-0" : "flex-1"}`}
              >
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                {i < 6 && <Skeleton className="flex-1 h-1 mx-2 rounded-full" />}
              </div>
            ))}
          </div>

          {/* Current section title + description */}
          <div className="flex flex-col items-center gap-1">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Tab buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            {[28, 36, 40, 44, 52, 24].map((w, i) => (
              <Skeleton
                key={i}
                className="h-7 rounded-full"
                style={{ width: `${w * 4}px` }}
              />
            ))}
          </div>
        </div>

        {/* Form content card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-6 w-48" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Form fields */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}

            {/* Two-column row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Skeleton className="h-10 w-24 rounded-md" />
              <div className="flex gap-3">
                <Skeleton className="h-10 w-20 rounded-md" />
                <Skeleton className="h-10 w-28 rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
}

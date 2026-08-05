import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileEditPageHeader } from "@/components/profile-edit-page-header";

export default function ProfileEditLoading() {
  return (
    <div className="min-h-screen">
      <PageContainer className="space-y-8">
        {/* Real header (static content) so the page doesn't jump when data lands */}
        <ProfileEditPageHeader />

        {/* Progress indicator panel */}
        <div className="grain space-y-5 rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>

          {/* Step circles with connecting lines (hidden on mobile) */}
          <div className="hidden items-center space-x-2 md:flex">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className={`flex items-center ${i === 6 ? "grow-0" : "flex-1"}`}
              >
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                {i < 6 && (
                  <Skeleton className="mx-2 h-[3px] flex-1 rounded-full" />
                )}
              </div>
            ))}
          </div>

          {/* Current section title + description */}
          <div className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Tab buttons */}
          <div className="flex flex-wrap justify-center gap-2">
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
        <div className="rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-7 w-48" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>

          <div className="space-y-6">
            {/* Form fields */}
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}

            {/* Two-column row */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between border-t border-forest-500/10 pt-6 dark:border-cream-50/10">
              <Skeleton className="h-9 w-28 rounded-full" />
              <div className="flex gap-3">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-32 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}

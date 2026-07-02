import { PageContainer } from "@/components/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ShiftDetailLoading() {
  return (
    <PageContainer className="space-y-6">
      {/* Back link */}
      <Skeleton className="h-5 w-28" />

      {/* Hero panel */}
      <Skeleton className="h-72 w-full rounded-[2.5rem]" />

      {/* Body grid */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-7">
          {/* Where card */}
          <div className="overflow-hidden rounded-3xl border border-forest-500/10 dark:border-cream-50/10">
            <div className="flex items-start justify-between gap-4 p-6 sm:p-7">
              <div className="space-y-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <div className="border-t border-forest-500/10 dark:border-cream-50/10">
              <Skeleton className="h-56 w-full rounded-none" />
            </div>
          </div>

          {/* Calendar + share card */}
          <div className="rounded-3xl border border-forest-500/10 p-6 sm:p-7 dark:border-cream-50/10">
            <Skeleton className="mb-5 h-3 w-24" />
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-8 w-20 rounded-full" />
                  <Skeleton className="h-8 w-20 rounded-full" />
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Signup sidebar */}
        <aside className="lg:col-span-5">
          <div className="rounded-3xl border border-forest-500/10 p-6 sm:p-8 dark:border-cream-50/10">
            <Skeleton className="mb-4 h-3 w-20" />
            <Skeleton className="mb-4 h-12 w-24" />
            <Skeleton className="mb-2 h-2 w-full rounded-full" />
            <Skeleton className="mb-6 h-4 w-48" />
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// These sections use the page's ring-1 rounded-2xl surface rather than <Card>.
const SURFACE = "rounded-2xl bg-card shadow-sm ring-1 ring-border dark:bg-white/[0.02]";

// Recipients per location card, so the grid reads as real data.
const LOCATION_RECIPIENTS = [2, 1, 3, 1, 2, 1];

function SectionHeading({
  titleWidth,
  descriptionWidth,
  icon = false,
}: {
  titleWidth: string;
  descriptionWidth: string;
  icon?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        {icon && <Skeleton className="size-5 rounded" />}
        <Skeleton className={cn("h-7", titleWidth)} />
      </div>
      <Skeleton className={cn("h-4 max-w-full", descriptionWidth)} />
    </>
  );
}

export default function RestaurantManagersLoading() {
  return (
    <AdminPageSkeleton
      title="Restaurant Manager Assignments"
      description="Make sure every venue has someone alerted to cancellations and signups awaiting approval."
      className="space-y-8"
    >
      {/* Coverage health banner + KPI tiles */}
      <div aria-hidden="true" className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-6 w-64 max-w-full" />
              <Skeleton className="h-4 w-[28rem] max-w-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn(SURFACE, "p-4")}>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="size-7 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-8 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Coverage by location */}
      <section aria-hidden="true" className="space-y-3">
        <SectionHeading titleWidth="w-52" descriptionWidth="w-96" icon />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {LOCATION_RECIPIENTS.map((recipients, i) => (
            <div key={i} className={cn(SURFACE, "flex flex-col overflow-hidden")}>
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 pl-6">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="flex flex-1 flex-col gap-2 px-5 pb-4 pl-6">
                <ul className="space-y-1.5">
                  {Array.from({ length: recipients }).map((_, j) => (
                    <li key={j} className="flex items-center gap-2.5">
                      <Skeleton className="size-7 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </li>
                  ))}
                </ul>
                <Skeleton className="mt-auto h-6 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Current assignments + assign panel */}
      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
      >
        <section className="space-y-3">
          <SectionHeading titleWidth="w-48" descriptionWidth="w-96" />
          <div className={cn(SURFACE, "p-4 sm:p-5")}>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto_auto] items-center gap-4 border-b px-3 pb-2 sm:grid">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <span className="w-8" />
            </div>
            <ul className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <li
                  key={i}
                  className="grid grid-cols-1 items-center gap-3 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto_auto] sm:gap-4 sm:px-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Skeleton className="size-9 shrink-0 rounded-full" />
                    <div className="min-w-0 space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-[1.15rem] w-8 rounded-full sm:mx-auto" />
                  <Skeleton className="size-8 justify-self-end sm:justify-self-center" />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-3 lg:self-start">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded" />
              <Skeleton className="h-7 w-40" />
            </div>
            <Skeleton className="h-9 w-48" />
          </div>
          <Skeleton className="h-4 w-80 max-w-full" />
          <div className={cn(SURFACE, "space-y-5 p-5")}>
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-11 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="flex items-start gap-3 rounded-xl border px-3.5 py-3">
              <Skeleton className="mt-0.5 size-4 shrink-0 rounded-[4px]" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-full" />
          </div>
        </section>
      </div>
    </AdminPageSkeleton>
  );
}

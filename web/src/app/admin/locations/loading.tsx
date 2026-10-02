import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const KPI_LABELS = ["w-28", "w-24", "w-20", "w-16"];
const VENUES = [
  { name: "w-40", address: "w-64" },
  { name: "w-32", address: "w-56" },
  { name: "w-44", address: "w-72" },
  { name: "w-36", address: "w-60" },
];

/** Same surface as the venue rows and KPI tiles (rounded-xl, border, shadow). */
const SURFACE = "rounded-xl border bg-card shadow-sm";

export default function LocationsLoading() {
  return (
    <AdminPageSkeleton
      title="Restaurant locations"
      description="Keep every venue visible to volunteers and its service settings up to date"
      className="space-y-8"
    >
      {/* Network overview: status banner + KPI tiles */}
      <div aria-hidden="true" className="space-y-4">
        <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex h-[23px] items-center sm:h-[25px]">
                <Skeleton className="h-5 w-72 max-w-full" />
              </div>
              <div className="mt-0.5 flex h-5 items-center">
                <Skeleton className="h-3.5 w-[34rem] max-w-full" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {KPI_LABELS.map((width, i) => (
            <div key={i} className={cn(SURFACE, "p-4")}>
              <div className="flex items-center justify-between gap-2">
                <Skeleton className={cn("h-3", width)} />
                <Skeleton className="size-7 shrink-0 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-[30px] w-12" />
            </div>
          ))}
        </div>
      </div>

      <section aria-hidden="true" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex h-7 items-center">
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-[30rem] max-w-full" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-40 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        </div>

        <ul className="space-y-3">
          {VENUES.map((venue, i) => (
            <li key={i} className={cn(SURFACE, "relative overflow-hidden")}>
              <span className="absolute inset-y-0 left-0 w-1 bg-muted" />
              <div className="flex flex-col gap-4 p-5 pl-6 lg:flex-row lg:items-center lg:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <Skeleton className={cn("h-5", venue.name)} />
                    <Skeleton className="h-5 w-32 rounded-full" />
                  </div>
                  <div className="mt-1.5 flex h-5 items-center">
                    <Skeleton className={cn("h-3.5 max-w-full", venue.address)} />
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Skeleton className="h-2.5 w-10" />
                    <div className="flex -space-x-1.5">
                      <Skeleton className="size-6 rounded-full ring-2 ring-card" />
                      <Skeleton className="size-6 rounded-full ring-2 ring-card" />
                    </div>
                  </div>
                </div>

                <div className="grid shrink-0 grid-cols-3 gap-4 border-border/60 lg:w-80 lg:border-l lg:pl-6 xl:w-88">
                  {["w-14", "w-20", "w-20"].map((label, f) => (
                    <div key={f} className="min-w-0">
                      <div className="flex h-4 items-center">
                        <Skeleton className={cn("h-2.5", label)} />
                      </div>
                      <Skeleton className="mt-1 h-6 w-10" />
                      {f === 0 && <Skeleton className="mt-1 h-3 w-20 max-w-full" />}
                    </div>
                  ))}
                </div>

                <div className="flex shrink-0 items-center gap-1 self-start lg:self-center">
                  <Skeleton className="h-8 w-16 rounded-full" />
                  <Skeleton className="size-8 rounded-full" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Collapsed "Disabled locations" bar */}
      <div
        aria-hidden="true"
        className="flex w-full items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 ring-1 ring-border/60"
      >
        <div className="flex h-6 items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="hidden h-3 w-48 sm:block" />
      </div>
    </AdminPageSkeleton>
  );
}

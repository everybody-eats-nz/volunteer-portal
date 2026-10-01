import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Pill switch (bg-muted track, first segment raised), as in the period bar. */
function SegmentSwitch({ widths }: { widths: string[] }) {
  return (
    <div className="flex gap-1 rounded-full bg-muted p-0.5">
      {widths.map((width, i) => (
        <span
          key={i}
          className={cn(
            "flex h-7 items-center rounded-full px-3",
            i === 0 && "bg-card shadow-sm"
          )}
        >
          <Skeleton
            className={cn("h-3", width, i === 0 ? "bg-muted" : "bg-foreground/[0.07]")}
          />
        </span>
      ))}
    </div>
  );
}

const SHARES = ["w-32", "w-24", "w-36", "w-20"];
// Trips per day, with each day's running row offset for varied widths.
const DAYS = [
  { trips: 3, offset: 0 },
  { trips: 2, offset: 3 },
  { trips: 3, offset: 5 },
];

const TH = "h-9 px-2 text-left align-middle";
const TD = "px-2 py-3 align-top";

export default function VanTripsLoading() {
  return (
    <AdminPageSkeleton
      title="Van trips"
      description="The mileage ledger behind the monthly report, with the odometer photo behind every reading."
    >
      <div className="space-y-4 border-b pb-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="size-9" />
              <Skeleton className="h-9 w-[13rem] rounded-lg" />
              <span className="size-9" />
            </div>
            <SegmentSwitch widths={["w-10", "w-10", "w-12"]} />
          </div>
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 min-w-[13rem] flex-1 rounded-lg sm:max-w-xs" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <section className="space-y-7">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          <div>
            <div className="flex items-end gap-2">
              <Skeleton className="h-12 w-40 sm:h-[3.75rem] sm:w-48" />
              <Skeleton className="mb-1 h-5 w-8" />
            </div>
            <div className="mt-2 space-y-1.5 py-0.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <Skeleton className="h-5 w-56" />
              <SegmentSwitch widths={["w-12", "w-12"]} />
            </div>
            <ul className="mt-4 space-y-3">
              {SHARES.map((width, i) => (
                <li key={i}>
                  <div className="flex h-5 items-center gap-2.5">
                    <Skeleton className={cn("h-3.5", width)} />
                    <Skeleton className="h-3 w-12" />
                    <span className="flex-1" />
                    <Skeleton className="h-3.5 w-14" />
                    <Skeleton className="h-3.5 w-9" />
                  </div>
                  <Skeleton className="mt-1.5 h-2 w-full rounded-full" />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-4">
          {["w-28", "w-20", "w-24", "w-20"].map((width, i) => (
            <div key={i} className="bg-card px-4 py-3">
              <Skeleton className={cn("h-3.5", width)} />
              <Skeleton className="mt-2 h-6 w-12" />
            </div>
          ))}
        </div>
      </section>

      <div aria-hidden="true" className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className={TH}>
                <Skeleton className="h-3.5 w-10" />
              </th>
              <th className={cn(TH, "hidden lg:table-cell")}>
                <Skeleton className="h-3.5 w-8" />
              </th>
              <th className={cn(TH, "hidden xl:table-cell")}>
                <Skeleton className="h-3.5 w-12" />
              </th>
              <th className={cn(TH, "hidden lg:table-cell")}>
                <Skeleton className="h-3.5 w-8" />
              </th>
              <th className={cn(TH, "hidden xl:table-cell")}>
                <Skeleton className="h-3.5 w-14" />
              </th>
              <th className={cn(TH, "hidden xl:table-cell")}>
                <Skeleton className="ml-auto h-3.5 w-16" />
              </th>
              <th className={TH}>
                <Skeleton className="ml-auto h-3.5 w-14" />
              </th>
              <th className={TH}>
                <Skeleton className="ml-auto h-3.5 w-12" />
              </th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <DayRows key={day.offset} trips={day.trips} offset={day.offset} />
            ))}
          </tbody>
        </table>
      </div>
    </AdminPageSkeleton>
  );
}

function DayRows({ trips, offset }: { trips: number; offset: number }) {
  return (
    <>
      <tr>
        <td colSpan={8} className="bg-muted/40 px-4 py-2">
          <div className="flex h-[22px] items-center justify-between gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </td>
      </tr>
      {Array.from({ length: trips }).map((_, i) => {
        const odd = (offset + i) % 2 === 1;
        return (
          <tr key={i} className="border-b">
            <td className={TD}>
              <Skeleton className="my-0.5 h-4 w-12" />
              <Skeleton className="mt-1 h-3 w-14" />
              <Skeleton className="mt-1.5 h-3.5 w-40 lg:hidden" />
            </td>
            <td className={cn(TD, "hidden lg:table-cell")}>
              <Skeleton className={cn("my-0.5 h-4", odd ? "w-20" : "w-24")} />
            </td>
            <td className={cn(TD, "hidden xl:table-cell")}>
              <Skeleton className={cn("my-0.5 h-4", odd ? "w-24" : "w-28")} />
            </td>
            <td className={cn(TD, "hidden lg:table-cell")}>
              <Skeleton className={cn("my-0.5 h-4", odd ? "w-28" : "w-24")} />
            </td>
            <td className={cn(TD, "hidden xl:table-cell")}>
              <Skeleton className={cn("my-0.5 h-4", odd ? "w-20" : "w-28")} />
            </td>
            <td className={cn(TD, "hidden xl:table-cell")}>
              <Skeleton className="my-0.5 ml-auto h-4 w-32" />
            </td>
            <td className={TD}>
              <Skeleton className="my-0.5 ml-auto h-4 w-12" />
            </td>
            <td className={TD}>
              <div className="ml-auto flex w-fit items-center gap-1 p-1">
                <Skeleton className="h-8 w-11 rounded" />
                <Skeleton className="h-8 w-11 rounded" />
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

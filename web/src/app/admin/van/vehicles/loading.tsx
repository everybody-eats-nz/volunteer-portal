import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TILES = ["w-24", "w-24", "w-16", "w-24"];
const NAMES = ["w-36", "w-28", "w-40", "w-32", "w-36", "w-28"];

export default function VanVehiclesLoading() {
  return (
    <AdminPageSkeleton
      title="Vans"
      description="Every van in the fleet, where it is right now, and the sticker that opens its log."
    >
      {/* Fleet board: four segmented tiles sharing one rounded frame. */}
      <div
        aria-hidden="true"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-border ring-1 ring-border lg:grid-cols-4"
      >
        {TILES.map((width, i) => (
          <div key={i} className="bg-card px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex h-10 items-center sm:h-12">
              <Skeleton className="h-8 w-12 sm:h-10 sm:w-14" />
            </div>
            <div className="mt-2 flex h-4 items-center">
              <Skeleton className={cn("h-2.5 sm:h-3", width)} />
            </div>
            <div className="mt-1 flex h-4 items-center">
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Skeleton className="h-9 w-full lg:max-w-xs" />
        <Skeleton className="h-11 w-full lg:w-44" />
        <Skeleton className="h-9 w-full rounded-full lg:ml-auto lg:w-28" />
      </div>

      <div className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-32" />
      </div>

      <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {NAMES.map((width, i) => (
          <li key={i}>
            <SkeletonCard className="flex h-full flex-col overflow-hidden rounded-2xl">
              <div className="relative">
                <Skeleton className="aspect-[16/9] w-full rounded-none" />
                <span className="absolute left-3 top-3 h-6 w-28 rounded-full bg-card/80 shadow-sm" />
                <span className="absolute bottom-3 left-3 h-[19px] w-20 rounded-[6px] bg-card/90 shadow-md" />
              </div>

              <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex h-[25px] items-center">
                      <Skeleton className={cn("h-5", width)} />
                    </div>
                    <div className="mt-1 flex h-5 items-center gap-3">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-3.5 w-28" />
                    </div>
                  </div>
                  <div className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center">
                    <Skeleton className="h-1.5 w-5 rounded-full" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border">
                  {["w-14", "w-12", "w-10"].map((label, m) => (
                    <div key={m} className="bg-card px-2.5 py-2.5 sm:px-3">
                      <div className="flex h-[15px] items-center">
                        <Skeleton className={cn("h-2.5", label)} />
                      </div>
                      <div className="mt-0.5 flex h-5 items-center">
                        <Skeleton className="h-3.5 w-16 max-w-full" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex h-[18px] items-center">
                  <Skeleton className={cn("h-3.5", i % 2 ? "w-40" : "w-52")} />
                </div>

                <div className="flex gap-2 border-t pt-3">
                  <Skeleton className="h-8 flex-1 rounded-full" />
                  <Skeleton className="h-8 flex-1 rounded-full" />
                </div>
              </div>
            </SkeletonCard>
          </li>
        ))}
      </ul>
    </AdminPageSkeleton>
  );
}

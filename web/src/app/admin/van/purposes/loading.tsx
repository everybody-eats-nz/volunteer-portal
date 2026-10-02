import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const LABEL_WIDTHS = ["w-36", "w-44", "w-28", "w-40", "w-32", "w-24"];

export default function VanPurposesLoading() {
  return (
    <AdminPageSkeleton
      title="Trip purposes"
      description="The order here is the order drivers see. Put the most common run first: it is the difference between one tap and three. Retiring a purpose hides it from drivers without touching the trips already logged against it."
      className="space-y-4"
    >
      <SkeletonCard>
        <ul>
          {LABEL_WIDTHS.map((width, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-0"
            >
              <span className="w-6 shrink-0">
                <Skeleton className="h-3.5 w-3" />
              </span>
              <div className="flex min-h-9 min-w-0 flex-1 items-center px-2.5">
                <Skeleton className={`h-4 ${width} max-w-full`} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Skeleton className="h-[1.15rem] w-8 rounded-full" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-3.5 w-14 shrink-0" />
              <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
              <div className="flex shrink-0 items-center gap-1">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-8 w-16 rounded-full" />
              </div>
            </li>
          ))}
        </ul>
      </SkeletonCard>

      <SkeletonCard>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-1.5 h-9 w-full" />
          </div>
          <div className="flex items-center gap-2 pb-2.5">
            <Skeleton className="h-[1.15rem] w-8 rounded-full" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="mb-0.5 h-9 w-20 rounded-full" />
        </div>
      </SkeletonCard>
    </AdminPageSkeleton>
  );
}

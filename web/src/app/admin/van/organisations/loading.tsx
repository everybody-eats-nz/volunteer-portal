import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const NAME_WIDTHS = ["w-44", "w-36", "w-52", "w-40", "w-32"];

export default function VanOrganisationsLoading() {
  return (
    <AdminPageSkeleton
      title="Organisations"
      description="Who a van can belong to, and who a volunteer drives for. Retiring one hides it from every picker without touching the trips already logged against it."
      className="space-y-4"
    >
      <SkeletonCard>
        <ul>
          {NAME_WIDTHS.map((width, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-0"
            >
              <div className="flex min-h-9 min-w-0 flex-1 items-center px-2.5">
                <Skeleton className={`h-4 ${width} max-w-full`} />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Skeleton className="h-[1.15rem] w-8 rounded-full" />
                <Skeleton className="h-3.5 w-20" />
              </div>
              <Skeleton className="h-3.5 w-36 shrink-0" />
              <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
              <Skeleton className="h-8 w-16 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      </SkeletonCard>

      <SkeletonCard>
        <div className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="mt-1.5 h-9 w-full" />
            </div>
            <div className="flex items-center gap-2 pb-2.5">
              <Skeleton className="h-[1.15rem] w-8 rounded-full" />
              <Skeleton className="h-3.5 w-20" />
            </div>
            <Skeleton className="mb-0.5 h-9 w-20 rounded-full" />
          </div>
          <div className="mt-3 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </SkeletonCard>
    </AdminPageSkeleton>
  );
}

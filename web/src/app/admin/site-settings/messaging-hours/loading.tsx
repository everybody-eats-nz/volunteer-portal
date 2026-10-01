import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const DAY_LABEL_WIDTHS = ["w-16", "w-16", "w-20", "w-16", "w-14", "w-16", "w-14"];

export default function MessagingHoursLoading() {
  return (
    <AdminPageSkeleton
      title="Messaging Hours"
      description={
        "Configure when the team typically replies to volunteer messages \u2014 shown in the mobile app as a soft expectation-setter"
      }
    >
      {["w-28", "w-36"].map((titleWidth, i) => (
        <SkeletonCard key={i} className="flex flex-col gap-6 py-6">
          <div className="flex items-center justify-between px-6">
            <Skeleton className={`h-5 ${titleWidth}`} />
            <Skeleton className="h-8 w-20" />
          </div>
          <ul className="space-y-2 px-6">
            {DAY_LABEL_WIDTHS.map((width, d) => (
              <li
                key={d}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b py-2 last:border-b-0 sm:grid-cols-[120px_88px_1fr_auto_1fr]"
              >
                <Skeleton className={`h-4 ${width}`} />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-[1.15rem] w-8 rounded-full" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <div className="col-span-2 flex items-center gap-2 sm:contents">
                  <Skeleton className="h-9 min-w-0 flex-1 sm:w-32 sm:flex-none" />
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-9 min-w-0 flex-1 sm:w-32 sm:flex-none" />
                </div>
              </li>
            ))}
          </ul>
        </SkeletonCard>
      ))}
    </AdminPageSkeleton>
  );
}

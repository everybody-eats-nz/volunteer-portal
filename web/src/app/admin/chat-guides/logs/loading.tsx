import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const MESSAGE_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/2", "w-3/5"];

export default function ChatLogsLoading() {
  return (
    <AdminPageSkeleton
      title="Chat Logs"
      description="Conversations volunteers have had with the AI assistant. Logs are kept for 30 days."
    >
      <Skeleton className="h-8 w-44" />

      <div className="grid gap-4 md:grid-cols-3">
        {["w-20", "w-24", "w-32"].map((width, i) => (
          <SkeletonCard key={i} className="flex flex-col gap-6 py-6">
            <div className="px-6">
              <Skeleton className={`h-4 ${width}`} />
            </div>
            <div className="px-6">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="mt-1 h-3 w-36" />
            </div>
          </SkeletonCard>
        ))}
      </div>

      <Skeleton className="h-9 w-full max-w-md" />

      <Skeleton className="h-4 w-36" />

      <div className="space-y-3">
        {MESSAGE_WIDTHS.map((width, i) => (
          <SkeletonCard
            key={i}
            className="flex items-start gap-3 rounded-lg p-4 shadow-none"
          >
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="ml-auto h-5 w-32 rounded-full" />
              </div>
              <Skeleton className={`mt-2 h-4 ${width}`} />
              <Skeleton className="mt-1.5 h-3 w-56 max-w-full" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </AdminPageSkeleton>
  );
}

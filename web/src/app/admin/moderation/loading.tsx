import {
  AdminPageSkeleton,
  KpiTileSkeleton,
  TableSkeleton,
  TabsSkeleton,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ModerationLoading() {
  return (
    <AdminPageSkeleton
      title="Content Moderation"
      description={
        "Review flagged content and user blocks \u2014 Apple Guideline 1.2 compliance"
      }
    >
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
        {[true, false, true].map((hint, i) => (
          <KpiTileSkeleton key={i} hint={hint} />
        ))}
      </div>

      <div aria-hidden="true">
        <TabsSkeleton tabs={["w-28", "w-24"]} />
        <div className="bg-card mt-4 overflow-hidden rounded-xl border shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
          <TableSkeleton
            card={false}
            rows={6}
            columns={["w-48", "w-24", "w-32", "w-16", "w-20"]}
            actions
          />
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

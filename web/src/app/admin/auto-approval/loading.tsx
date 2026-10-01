import {
  AdminPageSkeleton,
  TabsSkeleton,
} from "@/components/admin/admin-skeletons";

import { OverviewTabSkeleton } from "./_components/overview-skeleton";

export default function AutoApprovalLoading() {
  return (
    <AdminPageSkeleton
      title="Auto-Approval"
      description="Which signups confirm themselves, which wait for a person, and the reasoning behind every call."
    >
      {/* Mirrors <Tabs> (gap-2) + <TabsContent className="mt-6"> */}
      <div className="flex flex-col gap-2">
        {/* Overview / Coverage / Decisions / Rules */}
        <TabsSkeleton tabs={["w-28", "w-28", "w-28", "w-20"]} />
        <div className="mt-6">
          <OverviewTabSkeleton />
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

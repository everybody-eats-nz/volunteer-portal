import { UserPlus } from "lucide-react";

import {
  AdminPageSkeleton,
  TableSkeleton,
} from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminUsersLoading() {
  return (
    <AdminPageSkeleton
      title="User Management"
      description="Manage volunteers, administrators, and invite new users to the platform."
      actions={
        <Button size="sm" className="btn-primary gap-2" disabled>
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      }
    >
      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded" />
              <div className="space-y-1.5 py-0.5">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search, location filter, role and archived filters */}
      <div className="space-y-4" aria-hidden="true">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Skeleton className="h-9 w-full sm:max-w-md sm:flex-1" />
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-22" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-18" />
          <div className="ml-auto flex flex-wrap gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>

      {/* Users table + pagination */}
      <div aria-hidden="true">
        <TableSkeleton
          rows={10}
          columns={["w-40", "w-20", "w-24", "w-8", "w-24"]}
          avatar
          actions
          headerClassName="h-11"
          rowClassName="min-h-[65px]"
          className="rounded-md"
        />
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="flex flex-1 items-center gap-4">
            <Skeleton className="h-4 w-44" />
            <div className="hidden items-center gap-2 sm:flex">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-[70px]" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="hidden h-4 w-20 sm:block" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-14" />
          </div>
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

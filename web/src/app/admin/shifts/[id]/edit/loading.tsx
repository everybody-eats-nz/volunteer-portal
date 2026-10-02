import type { ReactNode } from "react";
import { Trash2Icon, ChevronLeft } from "lucide-react";

import {
  AdminPageSkeleton,
  SkeletonCard,
  SkeletonCardHeader,
} from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function FieldSkeleton({ labelWidth = "w-28" }: { labelWidth?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className={cn("h-4", labelWidth)} />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

function SectionSkeleton({
  titleWidth,
  children,
}: {
  titleWidth: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <Skeleton className={cn("mb-4 h-5", titleWidth)} />
      {children}
    </div>
  );
}

export default function EditShiftLoading() {
  return (
    <AdminPageSkeleton
      title="Edit shift"
      description="Modify details for this shift"
      className="space-y-2"
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            disabled
          >
            <Trash2Icon className="h-4 w-4 mr-2" />
            Delete Shift
          </Button>
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Back to shifts
          </Button>
        </>
      }
    >
      <SkeletonCard className="flex flex-col gap-6 py-6">
        <SkeletonCardHeader titleWidth="w-48" className="pb-6" />
        <div className="space-y-8 px-6">
          <SectionSkeleton titleWidth="w-20">
            <FieldSkeleton labelWidth="w-32" />
          </SectionSkeleton>

          <SectionSkeleton titleWidth="w-24">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <FieldSkeleton labelWidth="w-16" />
              <FieldSkeleton labelWidth="w-24" />
              <FieldSkeleton labelWidth="w-20" />
            </div>
          </SectionSkeleton>

          <SectionSkeleton titleWidth="w-36">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FieldSkeleton labelWidth="w-20" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          </SectionSkeleton>

          <SectionSkeleton titleWidth="w-44">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-3 w-80 max-w-full" />
            </div>
          </SectionSkeleton>

          <div className="flex flex-col justify-end gap-3 border-t pt-6 sm:flex-row">
            <Skeleton className="h-10 w-full sm:w-24" />
            <Skeleton className="h-10 w-full sm:w-36" />
          </div>
        </div>
      </SkeletonCard>
    </AdminPageSkeleton>
  );
}

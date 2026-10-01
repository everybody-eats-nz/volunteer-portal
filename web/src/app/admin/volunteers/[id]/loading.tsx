import type { ReactNode } from "react";
import { ChevronLeft, Megaphone } from "lucide-react";

import {
  AdminPageSkeleton,
  SkeletonCard,
} from "@/components/admin/admin-skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** `Card` with an icon + title `CardHeader`, as used throughout the profile. */
function ProfileCard({
  titleWidth = "w-36",
  action,
  className,
  children,
}: {
  titleWidth?: string;
  action?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <SkeletonCard className="flex flex-col gap-6 py-6">
      <div className="flex items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded" />
          <Skeleton className={cn("h-4", titleWidth)} />
        </div>
        {action && <Skeleton className={cn("h-8", action)} />}
      </div>
      <div className={cn("px-6", className)}>{children}</div>
    </SkeletonCard>
  );
}

/** Label above a value line or control, with an optional helper line. */
function Field({
  value = "h-4 w-40",
  helper = false,
}: {
  value?: string;
  helper?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className={value} />
      {helper && <Skeleton className="h-3 w-full max-w-64" />}
    </div>
  );
}

export default function VolunteerProfileLoading() {
  return (
    <AdminPageSkeleton
      title="Volunteer Profile"
      description="Comprehensive view of volunteer information and activity"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" disabled>
            <Megaphone className="h-4 w-4" />
            Announce
          </Button>
          <Button variant="outline" size="sm" className="gap-2" disabled>
            <ChevronLeft className="h-4 w-4" />
            Back to shifts
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Basic information */}
          <SkeletonCard className="py-6">
            <div className="flex flex-col items-center px-6">
              <Skeleton className="mb-4 size-24 rounded-full" />
              <Skeleton className="mb-2 h-7 w-44" />
              <Skeleton className="mb-4 h-4 w-52" />
              <Skeleton className="mb-4 h-4 w-28" />
              <div className="mb-3 flex justify-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <div className="mb-6 flex flex-wrap justify-center gap-2">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-5 w-32 rounded-full" />
              </div>
              <div className="grid w-full grid-cols-3 gap-3 border-t pt-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 rounded-lg border p-3"
                  >
                    <Skeleton className="size-4 rounded" />
                    <Skeleton className="h-7 w-8" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </div>
          </SkeletonCard>

          {/* Custom labels */}
          <ProfileCard titleWidth="w-28" action="w-16" className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </ProfileCard>

          {/* Admin actions */}
          <ProfileCard titleWidth="w-28" className="space-y-4">
            <Field value="h-8 w-36" helper />
            <Field value="h-8 w-40" helper />
            <Field value="h-6 w-48" helper />
            <Field value="h-6 w-44" helper />
          </ProfileCard>

          {/* Admin notes */}
          <ProfileCard titleWidth="w-28" className="space-y-3">
            <Skeleton className="h-8 w-28" />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </ProfileCard>

          {/* Contact information */}
          <ProfileCard titleWidth="w-40" className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-11 w-full rounded-lg" />
              </div>
            ))}
          </ProfileCard>
        </div>

        {/* Right column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Availability & preferences */}
          <ProfileCard titleWidth="w-48" className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <div className="space-y-2.5">
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-[62px] rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-8 w-36 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            </div>
            <div className="flex items-start gap-3 border-t pt-4">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </ProfileCard>

          {/* Additional information */}
          <ProfileCard titleWidth="w-44" className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </ProfileCard>

          {/* Shift history */}
          <SkeletonCard className="flex flex-col gap-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-[180px]" />
              </div>
            </div>
            <div className="space-y-3 px-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-3 rounded-lg bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

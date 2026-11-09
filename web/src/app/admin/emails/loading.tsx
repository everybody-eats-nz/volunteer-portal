import {
  AdminPageSkeleton,
  ListCardSkeleton,
} from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function AutomatedEmailsLoading() {
  return (
    <AdminPageSkeleton
      title="Automated Emails"
      description="Every email the portal sends by itself, and the Campaign Monitor template behind each one."
      className="mx-auto max-w-6xl space-y-4"
    >
      <div
        className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        aria-hidden="true"
      >
        <Skeleton className="h-9 w-full lg:max-w-xs" />
        <Skeleton className="h-9 w-[34rem] max-w-full rounded-full" />
      </div>
      <ListCardSkeleton
        rows={12}
        avatar={false}
        header={false}
        trailing="w-20"
      />
    </AdminPageSkeleton>
  );
}

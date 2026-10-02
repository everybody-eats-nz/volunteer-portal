import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

function SlotSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-xl p-4 ring-1 ring-border">
      <div className="flex h-3.5 items-center">
        <Skeleton className={`h-3 ${label}`} />
      </div>
      <Skeleton className="mt-2 h-11 w-full" />
      <div className="mt-2 flex h-4 items-center">
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

// The real description contains an em dash, kept as an escape here.
export default function MergeLocationsLoading() {
  return (
    <AdminPageSkeleton
      title="Merge duplicate locations"
      description={
        "Fold a duplicate venue name into the real one \u2014 its history moves across, then the duplicate is removed"
      }
      className="max-w-4xl space-y-6"
    >
      <div className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-28" />
      </div>

      <section
        aria-hidden="true"
        className="rounded-xl border bg-card p-5 shadow-sm sm:p-6"
      >
        <div className="flex h-4 items-center">
          <Skeleton className="h-2.5 w-40" />
        </div>
        <div className="mt-1.5 space-y-1.5 py-0.5">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <SlotSkeleton label="w-32" />
          <div className="hidden items-center sm:flex">
            <Skeleton className="size-9 rounded-full" />
          </div>
          <SlotSkeleton label="w-28" />
        </div>

        <div className="mt-5 flex justify-end">
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
      </section>
    </AdminPageSkeleton>
  );
}

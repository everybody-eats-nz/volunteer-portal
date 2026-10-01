import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Bordered table with a muted header row, as in `ParentalConsentTable`. */
function ConsentTableSkeleton({
  rows,
  columns,
  action = false,
}: {
  rows: number;
  columns: string[];
  action?: boolean;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="size-5 rounded" />
        <Skeleton className="h-5 w-44" />
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-muted/50 flex gap-6 px-4 py-3">
          {columns.map((_, i) => (
            <div key={i} className={cn("flex-1", i > 1 && "hidden md:block")}>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
          {action && (
            <div className="w-24">
              <Skeleton className="h-4 w-14" />
            </div>
          )}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-6 border-t px-4 py-3">
            {columns.map((width, c) => (
              <div
                key={c}
                className={cn("flex-1 space-y-1.5", c > 1 && "hidden md:block")}
              >
                <Skeleton className={cn("h-4", width)} />
                {(c === 0 || (action && (c === 2 || c === 3))) && (
                  <Skeleton className="h-3 w-24" />
                )}
              </div>
            ))}
            {action && <Skeleton className="h-8 w-24" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ParentalConsentLoading() {
  return (
    <AdminPageSkeleton
      title="Parental Consent Management"
      description="Manage parental consent approvals for volunteers under 16"
    >
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="size-4 rounded" />
            </div>
            <Skeleton className="mt-1 h-7 w-10" />
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded-lg border p-4" aria-hidden="true">
        <div className="flex items-start gap-3">
          <Skeleton className="mt-0.5 size-5 shrink-0 rounded" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <Skeleton className="h-4 w-full max-w-lg" />
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
      </div>

      {/* Pending and approved tables */}
      <div className="space-y-6" aria-hidden="true">
        <ConsentTableSkeleton
          rows={3}
          columns={["w-32", "w-12", "w-40", "w-28", "w-20"]}
          action
        />
        <ConsentTableSkeleton rows={4} columns={["w-32", "w-12", "w-24"]} />
      </div>
    </AdminPageSkeleton>
  );
}

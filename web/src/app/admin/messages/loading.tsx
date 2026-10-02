import { AdminPageSkeleton } from "@/components/admin/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const THREAD_PREVIEW_WIDTHS = [
  "w-48",
  "w-40",
  "w-52",
  "w-36",
  "w-44",
  "w-48",
  "w-32",
  "w-40",
];

export default function MessagesLoading() {
  return (
    <AdminPageSkeleton
      title="Messages"
      description={"Direct conversations with volunteers \u2014 any admin can reply"}
    >
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 min-w-[220px] max-w-md flex-1" />
          <Skeleton className="h-9 w-[140px]" />
          <Skeleton className="h-9 w-[170px]" />
          <Skeleton className="h-9 w-[70px]" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-9 sm:w-28" />
            <Skeleton className="h-8 w-36" />
          </div>
        </div>

        <div className="grid min-h-[70vh] grid-cols-1 gap-4 lg:grid-cols-[340px_1fr] xl:grid-cols-[360px_1fr]">
          <div className="bg-card flex max-h-[78vh] flex-col overflow-hidden rounded-xl border shadow-sm">
            <ul className="flex-1 divide-y overflow-hidden">
              {THREAD_PREVIEW_WIDTHS.map((width, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-6" />
                    </div>
                    <Skeleton className={`mt-1.5 h-3 max-w-full ${width}`} />
                    <Skeleton className="mt-2 h-2.5 w-16" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-card flex max-h-[78vh] min-h-[60vh] flex-col overflow-hidden rounded-xl border shadow-sm">
            <div className="flex flex-1 items-center justify-center px-6 py-16">
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-5 w-52" />
                <Skeleton className="h-4 w-72 max-w-full" />
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminPageSkeleton>
  );
}

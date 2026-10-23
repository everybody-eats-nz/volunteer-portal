import { Skeleton } from "@/components/ui/skeleton";

/** Holds the player and share panel's space while the year loads. */
export function YearInReviewSkeleton() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-12">
      <Skeleton className="mx-auto aspect-[9/16] w-full max-w-[min(400px,calc((100dvh-10rem)*9/16))] rounded-[2rem] lg:mx-0" />
      <Skeleton className="h-64 w-full rounded-3xl" />
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import type { YearInReviewProps } from "@/remotion/year-in-review/schema";
import { cn } from "@/lib/utils";

const YearInReviewPlayer = dynamic(() => import("./year-in-review-player"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm font-medium text-forest-200">
      Loading your video…
    </div>
  ),
});

/** A 9:16 phone-shaped frame holding the video player. */
export function YearInReviewPlayerFrame({
  data,
  className,
}: {
  readonly data: YearInReviewProps;
  readonly className?: string;
}) {
  return (
    <div
      data-testid="year-in-review-player"
      className={cn(
        "relative aspect-[9/16] w-full overflow-hidden rounded-[2rem] bg-forest-700 shadow-xl shadow-forest-800/20",
        className
      )}
    >
      <YearInReviewPlayer data={data} />
    </div>
  );
}

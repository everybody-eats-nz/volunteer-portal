import { Skeleton } from "@/components/ui/skeleton";

/** Forest-tinted skeleton block, matching the marketing palette. */
function Bar({ className }: { className?: string }) {
  return (
    <Skeleton
      className={`rounded-lg bg-forest-500/10 dark:bg-cream-50/10 ${className ?? ""}`}
    />
  );
}

/**
 * Loading skeleton for the multi-step registration page. Mirrors the real
 * layout (branded header, progress indicator, form card) so there's no
 * layout shift when `register-client` finishes hydrating.
 */
export function RegisterSkeleton() {
  return (
    <div
      className="min-h-screen space-y-2"
      data-testid="register-skeleton"
      aria-hidden
    >
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Branded header */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-block h-px w-8 bg-forest-500/30 dark:bg-cream-50/20" />
            <Bar className="h-3 w-40" />
          </div>
          <Bar className="h-11 w-80 max-w-full sm:h-14" />
          <div className="mt-4 space-y-2">
            <Bar className="h-4 w-full max-w-2xl" />
            <Bar className="h-4 w-2/3 max-w-md" />
          </div>
          <Bar className="mt-6 h-9 w-64 rounded-full" />
        </div>

        {/* Progress indicator (desktop only) */}
        <div className="hidden rounded-3xl border border-forest-500/10 bg-card p-6 shadow-sm dark:border-cream-50/10 md:block">
          <div className="mb-4 flex items-center justify-between">
            <Bar className="h-6 w-48" />
            <Bar className="h-6 w-20 rounded-full" />
          </div>
          <div className="mb-4 flex items-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center ${i === 5 ? "grow-0" : "flex-1"}`}
              >
                <Bar className="h-10 w-10 shrink-0 rounded-full" />
                {i < 5 && <Bar className="mx-2 h-1 flex-1 rounded-full" />}
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-2">
            <Bar className="h-4 w-32" />
            <Bar className="h-3 w-44" />
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-3xl border border-forest-500/10 bg-card shadow-[0_24px_70px_-30px_rgb(14_42_28/0.45)] dark:border-cream-50/10">
          <div className="flex items-center gap-3 p-6 pb-6">
            <Bar className="h-10 w-10 shrink-0 rounded-xl" />
            <Bar className="h-6 w-44" />
          </div>
          <div className="px-6 pb-6">
            {/* Welcome panel */}
            <Bar className="h-20 w-full rounded-2xl" />

            {/* OAuth + divider */}
            <div className="mt-6 space-y-3">
              <Bar className="mx-auto h-4 w-64" />
              <Bar className="h-11 w-full rounded-full" />
              <Bar className="h-11 w-full rounded-full" />
            </div>
            <Bar className="mx-auto my-6 h-3 w-56" />

            {/* Email + password fields */}
            <div className="space-y-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Bar className="h-4 w-32" />
                  <Bar className="h-11 w-full rounded-xl" />
                </div>
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="mt-8 flex items-center justify-between border-t border-forest-500/10 pt-6 dark:border-cream-50/10">
              <Bar className="h-10 w-28 rounded-full" />
              <Bar className="h-11 w-32 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

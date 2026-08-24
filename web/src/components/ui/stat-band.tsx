import { cn } from "@/lib/utils";

export interface StatBandStat {
  label: string;
  value: string | number;
  subtitle?: string;
  testId?: string;
}

/**
 * Editorial stats band (new.everybodyeats.nz): hairline-divided cells on a
 * single rounded panel, Fraunces display numerals with uppercase kickers —
 * the same treatment as the landing page's "mahi in numbers" section.
 */
export function StatBand({
  stats,
  className,
  testId,
}: {
  stats: StatBandStat[];
  className?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-forest-500/15 ring-1 ring-forest-500/15 lg:grid-cols-4 dark:bg-cream-50/15 dark:ring-cream-50/15",
        className
      )}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          data-testid={stat.testId}
          className="grain bg-background px-5 py-6 sm:px-8 sm:py-8"
        >
          <div
            data-testid={stat.testId ? `${stat.testId}-count` : undefined}
            className="stat-band-value display text-4xl tracking-tight text-forest-700 tabular-nums sm:text-5xl dark:text-cream-50"
          >
            {stat.value}
          </div>
          <div className="mt-2 text-[0.65rem] uppercase tracking-[0.15em] text-forest-500/70 sm:text-xs dark:text-cream-50/55">
            {stat.label}
          </div>
          {stat.subtitle && (
            <div className="mt-1 text-xs text-forest-500/70 dark:text-cream-50/55">
              {stat.subtitle}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

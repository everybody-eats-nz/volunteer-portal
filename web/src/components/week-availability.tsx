import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWeekAvailability } from "@/lib/week-availability";

interface WeekAvailabilityProps {
  /** Available days in any casing (e.g. "monday" or "Monday"). Order is ignored. */
  availableDays: string[];
  className?: string;
}

/**
 * Renders a Monday-first week strip. Every day Mon-Sun is always shown in order,
 * with available days highlighted - so the data is always presented consistently
 * regardless of how it was stored.
 */
export function WeekAvailability({
  availableDays,
  className,
}: WeekAvailabilityProps) {
  const { days, count } = getWeekAvailability(availableDays);

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => (
          <div
            key={day.key}
            title={`${day.full}: ${day.isAvailable ? "Available" : "Unavailable"}`}
            aria-label={`${day.full}: ${day.isAvailable ? "Available" : "Unavailable"}`}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-colors",
              day.isAvailable
                ? "border-emerald-500/30 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-950/40"
                : "border-dashed border-border bg-muted/30"
            )}
          >
            <span
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wide",
                day.isAvailable
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-muted-foreground/60"
              )}
            >
              {day.short}
            </span>
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full",
                day.isAvailable
                  ? "bg-emerald-500 text-white dark:bg-emerald-500"
                  : "bg-transparent"
              )}
            >
              {day.isAvailable ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : (
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {count === 0 ? (
          <span className="italic">No days specified</span>
        ) : (
          <>
            Available{" "}
            <span className="font-medium text-foreground">
              {count} {count === 1 ? "day" : "days"}
            </span>{" "}
            a week
          </>
        )}
      </p>
    </div>
  );
}

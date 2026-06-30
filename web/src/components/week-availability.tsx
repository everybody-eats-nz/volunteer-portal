import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = [
  { key: "monday", short: "Mon", full: "Monday" },
  { key: "tuesday", short: "Tue", full: "Tuesday" },
  { key: "wednesday", short: "Wed", full: "Wednesday" },
  { key: "thursday", short: "Thu", full: "Thursday" },
  { key: "friday", short: "Fri", full: "Friday" },
  { key: "saturday", short: "Sat", full: "Saturday" },
  { key: "sunday", short: "Sun", full: "Sunday" },
] as const;

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
  const available = new Set(availableDays.map((day) => day.toLowerCase().trim()));
  const count = DAYS_OF_WEEK.filter((day) => available.has(day.key)).length;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS_OF_WEEK.map((day) => {
          const isAvailable = available.has(day.key);
          return (
            <div
              key={day.key}
              title={`${day.full}: ${isAvailable ? "Available" : "Unavailable"}`}
              aria-label={`${day.full}: ${isAvailable ? "Available" : "Unavailable"}`}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border py-2.5 transition-colors",
                isAvailable
                  ? "border-emerald-500/30 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-950/40"
                  : "border-dashed border-border bg-muted/30"
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-wide",
                  isAvailable
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-muted-foreground/60"
                )}
              >
                {day.short}
              </span>
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full",
                  isAvailable
                    ? "bg-emerald-500 text-white dark:bg-emerald-500"
                    : "bg-transparent"
                )}
              >
                {isAvailable ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : (
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                )}
              </span>
            </div>
          );
        })}
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

"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Coffee, Ticket, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DAY_REPORT_TYPES,
  DAY_REPORT_TYPE_META,
  type DayReportType,
} from "@/lib/day-reports";

export const REPORT_TYPE_ICON: Record<
  DayReportType,
  React.ComponentType<{ className?: string }>
> = {
  SERVICE_NIGHT: UtensilsCrossed,
  EVENT: Ticket,
  CAFE: Coffee,
};

// The selected pill takes the report's accent, so the type reads at a glance.
const SELECTED: Record<DayReportType, string> = {
  SERVICE_NIGHT:
    "data-[state=checked]:bg-emerald-700 data-[state=checked]:text-white dark:data-[state=checked]:bg-emerald-600",
  EVENT:
    "data-[state=checked]:bg-violet-700 data-[state=checked]:text-white dark:data-[state=checked]:bg-violet-600",
  CAFE: "data-[state=checked]:bg-sky-700 data-[state=checked]:text-white dark:data-[state=checked]:bg-sky-600",
};

/**
 * Chooses what the day was. A radio group, so arrow keys move between the
 * options and screen readers announce the choice.
 */
export function ReportTypePicker({
  value,
  onChange,
}: {
  value: DayReportType;
  onChange: (value: DayReportType) => void;
}) {
  // Sized by the space the card gives it, not the viewport: compact below
  // 24rem, and icon-free when even that won't fit.
  return (
    <div className="@container">
      <RadioGroupPrimitive.Root
        value={value}
        onValueChange={(v) => onChange(v as DayReportType)}
        aria-label="What was this day?"
        className="inline-flex w-full rounded-xl border border-border/80 bg-card/80 p-1 shadow-xs sm:w-auto"
        data-testid="report-type-picker"
      >
        {DAY_REPORT_TYPES.map((type) => {
          const Icon = REPORT_TYPE_ICON[type];
          return (
            <RadioGroupPrimitive.Item
              key={type}
              value={type}
              data-testid={`report-type-${type.toLowerCase().replace("_", "-")}`}
              className={cn(
                "flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-[13px] @sm:gap-1.5 @sm:px-3 @sm:text-sm font-medium text-muted-foreground transition-colors data-[state=unchecked]:hover:bg-muted data-[state=unchecked]:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:flex-none",
                "data-[state=checked]:shadow-sm",
                SELECTED[type]
              )}
            >
              <Icon
                className="h-4 w-4 shrink-0 @max-[17rem]:hidden"
                aria-hidden
              />
              {DAY_REPORT_TYPE_META[type].label}
            </RadioGroupPrimitive.Item>
          );
        })}
      </RadioGroupPrimitive.Root>
    </div>
  );
}

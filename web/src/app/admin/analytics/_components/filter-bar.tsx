"use client";

import { format } from "date-fns";
import {
  Calendar as CalendarIcon,
  Download,
  Loader2,
  MapPin,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DayOfWeekFilter } from "@/components/day-of-week-filter";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "./primitives";

const PERIODS = [
  { value: "1", label: "1M" },
  { value: "3", label: "3M" },
  { value: "6", label: "6M" },
  { value: "12", label: "12M" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
];

export interface FilterState {
  months: string;
  location: string;
  days: string;
  from: string;
  to: string;
}

export function FilterBar({
  state,
  setState,
  locations,
  hasCustomRange,
  rangeError,
  isPending,
  exporting,
  onApply,
  onExport,
}: {
  state: FilterState;
  setState: (patch: Partial<FilterState>) => void;
  locations: Array<{ value: string; label: string }>;
  hasCustomRange: boolean;
  rangeError: boolean;
  isPending: boolean;
  exporting: boolean;
  onApply: () => void;
  onExport: () => void;
}) {
  const fromDate = state.from ? new Date(`${state.from}T00:00:00`) : undefined;
  const toDate = state.to ? new Date(`${state.to}T00:00:00`) : undefined;

  // Bound the calendar's month/year dropdowns to the range of available data
  // (the restaurant has operated since 2017) so admins can jump straight to a
  // year instead of clicking back one month at a time.
  const calendarStartMonth = new Date(2017, 0, 1);
  const calendarEndMonth = new Date();

  return (
    <div className="sticky top-2 z-30 rounded-xl border bg-card/95 shadow-md supports-[backdrop-filter]:bg-card/80 supports-[backdrop-filter]:backdrop-blur">
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 hidden items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:flex">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Period
          </span>

          {/* Period pills */}
          <SegmentedControl
            size="md"
            value={hasCustomRange ? "custom" : state.months}
            onChange={(v) => {
              if (v === "custom") return;
              setState({ months: v, from: "", to: "" });
            }}
            options={
              hasCustomRange
                ? [...PERIODS, { value: "custom", label: "Custom" }]
                : PERIODS
            }
          />

          {/* Custom date range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={hasCustomRange ? "secondary" : "outline"}
                size="sm"
                className={cn(
                  "justify-start gap-2 font-normal",
                  !hasCustomRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4 shrink-0" />
                {fromDate && toDate ? (
                  <span className="truncate">
                    {format(fromDate, "MMM d")} – {format(toDate, "MMM d, yyyy")}
                  </span>
                ) : fromDate ? (
                  <span className="truncate">
                    {format(fromDate, "MMM d, yyyy")} – …
                  </span>
                ) : (
                  <span>Custom range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                captionLayout="dropdown"
                startMonth={calendarStartMonth}
                endMonth={calendarEndMonth}
                defaultMonth={fromDate}
                selected={{ from: fromDate, to: toDate }}
                onSelect={(range) => {
                  setState({
                    from: range?.from ? format(range.from, "yyyy-MM-dd") : "",
                    to: range?.to ? format(range.to, "yyyy-MM-dd") : "",
                  });
                }}
                numberOfMonths={2}
                autoFocus
              />
            </PopoverContent>
          </Popover>

          {hasCustomRange && (
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-muted-foreground"
              onClick={() => setState({ from: "", to: "" })}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Location */}
            <Select
              value={state.location}
              onValueChange={(v) => setState({ location: v })}
            >
              <SelectTrigger className="w-[170px] gap-1.5" size="sm">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.value} value={loc.value}>
                    {loc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={exporting}
              title="Download the applied service-night data as CSV"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Export</span>
            </Button>

            <Button
              size="sm"
              onClick={onApply}
              disabled={isPending || rangeError}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </div>
        </div>

        {/* Day-of-week row */}
        <div className="flex items-center gap-2 border-t pt-3">
          <DayOfWeekFilter
            value={state.days}
            onChange={(v) => setState({ days: v })}
          />
        </div>

        {rangeError && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            Set both From and To dates (From must be on or before To).
          </p>
        )}
      </div>
    </div>
  );
}

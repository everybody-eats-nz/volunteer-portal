"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DateFilterProps {
  rawDateFrom?: string;
  rawDateTo?: string;
}

export function DateFilter({ rawDateFrom, rawDateTo }: DateFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const createFilterUrl = (newParams: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams);

    // Apply new params
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    return `/admin/shifts?${params.toString()}`;
  };

  // Parse dates for display and calendar state
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  try {
    if (rawDateFrom) {
      dateFrom = new Date(rawDateFrom);
    }
    if (rawDateTo) {
      dateTo = new Date(rawDateTo);
    }
  } catch (error) {
    // Invalid date format, ignore
    console.error("Invalid date format:", error);
  }

  const dateRange: DateRange | undefined =
    dateFrom || dateTo ? { from: dateFrom, to: dateTo } : undefined;

  const handleDateRangeChange = (range: DateRange | undefined) => {
    const dateFromStr = range?.from
      ? format(range.from, "yyyy-MM-dd")
      : undefined;
    const dateToStr = range?.to ? format(range.to, "yyyy-MM-dd") : undefined;

    const url = createFilterUrl({
      dateFrom: dateFromStr,
      dateTo: dateToStr,
    });
    router.push(url);
  };

  const clearDates = () => {
    const url = createFilterUrl({ dateFrom: undefined, dateTo: undefined });
    router.push(url);
  };

  return (
    <div className="flex items-center gap-3" data-testid="date-range-filter">
      {/* Hidden inputs for test compatibility */}
      <input type="hidden" data-testid="date-from-filter" value={rawDateFrom || ""} readOnly />
      <input type="hidden" data-testid="date-to-filter" value={rawDateTo || ""} readOnly />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
            data-testid="date-filter-trigger"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "MMM dd")} -{" "}
                  {format(dateRange.to, "MMM dd")}
                </>
              ) : (
                format(dateRange.from, "MMM dd, y")
              )
            ) : (
              <span>Pick dates</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" data-testid="date-filter-popover">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={handleDateRangeChange}
            numberOfMonths={2}
            data-testid="date-filter-calendar"
          />
        </PopoverContent>
      </Popover>

      {(dateFrom || dateTo) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearDates}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 flex-shrink-0"
          data-testid="clear-date-filter-button"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

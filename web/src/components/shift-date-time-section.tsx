"use client";

import React from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateTimeSectionProps {
  templateStartTime?: string;
  templateEndTime?: string;
}

export function DateTimeSection({ templateStartTime, templateEndTime }: DateTimeSectionProps) {
  const [date, setDate] = React.useState<Date>();
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");

  // Update form values when template is applied
  React.useEffect(() => {
    if (templateStartTime) setStartTime(templateStartTime);
  }, [templateStartTime]);

  React.useEffect(() => {
    if (templateEndTime) setEndTime(templateEndTime);
  }, [templateEndTime]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          Date *
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-11",
                !date && "text-muted-foreground"
              )}
              data-testid="shift-date-input"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {/* Hidden input for form submission */}
        <input
          type="hidden"
          name="date"
          value={date ? format(date, "yyyy-MM-dd") : ""}
          required
        />
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="startTime"
          className="text-sm font-medium flex items-center gap-2"
        >
          <ClockIcon className="h-4 w-4 text-muted-foreground" />
          Start time *
        </Label>
        <div className="relative">
          <ClockIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="time"
            name="startTime"
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="pl-10 h-11"
            data-testid="shift-start-time-input"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="endTime"
          className="text-sm font-medium flex items-center gap-2"
        >
          <ClockIcon className="h-4 w-4 text-muted-foreground" />
          End time *
        </Label>
        <div className="relative">
          <ClockIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="time"
            name="endTime"
            id="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="pl-10 h-11"
            data-testid="shift-end-time-input"
          />
        </div>
      </div>
    </div>
  );
}

export function BulkDateRangeSection() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium flex items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        Date Range *
      </Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-11",
              !dateRange?.from && "text-muted-foreground"
            )}
            data-testid="bulk-date-range-input"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={setDateRange}
            initialFocus
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
      {/* Hidden inputs for form submission */}
      <input
        type="hidden"
        name="startDate"
        value={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
        required
      />
      <input
        type="hidden"
        name="endDate"
        value={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
        required
      />
    </div>
  );
}
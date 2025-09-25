"use client";

import { useState } from "react";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Users } from "lucide-react";
import { formatInNZT, isSameDayInNZT, nowInNZT } from "@/lib/timezone";
import { cn } from "@/lib/utils";

type ShiftSummary = {
  date: string;
  count: number;
  totalCapacity: number;
  totalConfirmed: number;
  locations: string[];
};

type ShiftCalendarProps = {
  selectedDate: Date;
  selectedLocation: string;
  shiftSummaries: ShiftSummary[];
  onDateSelect: (date: Date) => void;
  className?: string;
};

export function ShiftCalendar({
  selectedDate,
  selectedLocation,
  shiftSummaries,
  onDateSelect,
  className,
}: ShiftCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Create a map of dates that have shifts for quick lookup
  const shiftDates = new Set(
    shiftSummaries
      .filter(summary => 
        summary.locations.includes(selectedLocation) && summary.count > 0
      )
      .map(summary => summary.date)
  );

  // Get shift data for a specific date (using NZ timezone)
  const getShiftDataForDate = (date: Date) => {
    const dateStr = formatInNZT(date, "yyyy-MM-dd");
    return shiftSummaries.find(
      summary => summary.date === dateStr && summary.locations.includes(selectedLocation)
    );
  };

  // Check if a date has shifts (using NZ timezone)
  const hasShifts = (date: Date) => {
    const dateStr = formatInNZT(date, "yyyy-MM-dd");
    return shiftDates.has(dateStr);
  };

  // Get staffing status color
  const getStaffingColor = (confirmed: number, capacity: number) => {
    const percentage = (confirmed / capacity) * 100;
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-green-400";
    if (percentage >= 50) return "bg-yellow-500";
    if (percentage >= 25) return "bg-orange-500";
    return "bg-red-500";
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onDateSelect(date);
      setIsOpen(false);
    }
  };

  const selectedShiftData = getShiftDataForDate(selectedDate);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !selectedDate && "text-muted-foreground"
            )}
            data-testid="shift-calendar-trigger"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <div className="flex items-center gap-2 flex-1">
              <div>
                <div className="text-sm font-medium">
                  {formatInNZT(selectedDate, "MMM d, yyyy")}
                </div>
                <div className="text-xs text-slate-600">
                  {formatInNZT(selectedDate, "EEEE")}
                  {isSameDayInNZT(selectedDate, nowInNZT()) && (
                    <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      Today
                    </span>
                  )}
                </div>
              </div>
              {selectedShiftData && (
                <div className="ml-auto flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {selectedShiftData.count}
                  </Badge>
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      getStaffingColor(selectedShiftData.totalConfirmed, selectedShiftData.totalCapacity)
                    )}
                  />
                </div>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" data-testid="shift-calendar-popover">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            modifiers={{
              hasShifts: (date) => hasShifts(date),
              // NZT-centric approach: Compare dates in NZ timezone regardless of server/client timezone
              // This ensures calendar selection is consistent with NZ business logic
              selected: (date) => isSameDayInNZT(date, selectedDate),
            }}
            modifiersClassNames={{
              hasShifts: "bg-blue-50 hover:bg-blue-100 text-blue-900 font-medium rounded-md",
              selected: "bg-blue-600 text-white hover:bg-blue-700 rounded-md",
            }}
            classNames={{
              today: "",
            }}
            data-testid="shift-calendar"
            components={{
              DayButton: (props) => {
                const shiftData = getShiftDataForDate(props.day.date);
                const dayNum = formatInNZT(props.day.date, "d");
                
                return (
                  <CalendarDayButton
                    {...props}
                    className={cn(
                      props.className,
                      shiftData && "relative"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span>{dayNum}</span>
                      {shiftData && (
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full mt-0.5",
                            getStaffingColor(shiftData.totalConfirmed, shiftData.totalCapacity)
                          )}
                        />
                      )}
                    </div>
                  </CalendarDayButton>
                );
              },
            }}
            className="rounded-md border"
          />
          <div className="p-3 border-t bg-muted/50" data-testid="calendar-legend">
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="font-medium mb-2">Legend:</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Fully Staffed (100%+)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>Needs More (50-74%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>Critical (&lt;25%)</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
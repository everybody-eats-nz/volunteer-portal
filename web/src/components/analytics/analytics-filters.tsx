"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface Filters {
  location: string;
  startDate: string;
  endDate: string;
  volunteerGrade?: string;
  shiftTypeId?: string;
}

interface AnalyticsFiltersProps {
  filters: Filters;
  onChange: (filters: Partial<Filters>) => void;
  locations: readonly string[];
}

export function AnalyticsFilters({ filters, onChange, locations }: AnalyticsFiltersProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(
    filters.startDate ? new Date(filters.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    filters.endDate ? new Date(filters.endDate) : undefined
  );

  const handleDatePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    setStartDate(start);
    setEndDate(end);
    onChange({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    if (date) {
      onChange({ startDate: date.toISOString() });
    }
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    if (date) {
      onChange({ endDate: date.toISOString() });
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Filters
      </h3>

      <div className="space-y-4">
        {/* Location Filter */}
        <div>
          <label className="text-sm font-medium mb-2 block text-muted-foreground">Location</label>
          <Select
            value={filters.location || "all"}
            onValueChange={(value) => onChange({ location: value })}
          >
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location} value={location}>
                  {location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleStartDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={handleEndDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Volunteer Grade</label>
            <Select
              value={filters.volunteerGrade || "all"}
              onValueChange={(value) =>
                onChange({
                  volunteerGrade: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All grades</SelectItem>
                <SelectItem value="GREEN">🟢 Green</SelectItem>
                <SelectItem value="YELLOW">🟡 Yellow</SelectItem>
                <SelectItem value="PINK">🌸 Pink</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Quick Filters</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDatePreset(7)}
              className="hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Last 7 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDatePreset(30)}
              className="hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Last 30 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDatePreset(90)}
              className="hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Last 90 days
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

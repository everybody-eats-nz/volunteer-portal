"use client";

import { ShiftCalendar } from "./shift-calendar";
import { formatInNZT } from "@/lib/timezone";
import { useRouter } from "next/navigation";

type ShiftSummary = {
  date: string;
  count: number;
  totalCapacity: number;
  totalConfirmed: number;
  locations: string[];
};

type ShiftCalendarWrapperProps = {
  selectedDate: Date;
  selectedLocation: string;
  shiftSummaries: ShiftSummary[];
};

export function ShiftCalendarWrapper({
  selectedDate,
  selectedLocation,
  shiftSummaries,
}: ShiftCalendarWrapperProps) {
  const router = useRouter();

  const handleDateSelect = (date: Date) => {
    const dateStr = formatInNZT(date, "yyyy-MM-dd");
    router.push(`/admin/shifts?date=${dateStr}&location=${selectedLocation}`);
  };

  return (
    <ShiftCalendar
      selectedDate={selectedDate}
      selectedLocation={selectedLocation}
      shiftSummaries={shiftSummaries}
      onDateSelect={handleDateSelect}
    />
  );
}
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

  // Step to the previous/next calendar day in NZ. Pure date-string arithmetic
  // via UTC avoids any DST edge cases.
  const handleStep = (delta: number) => {
    const [y, m, d] = formatInNZT(selectedDate, "yyyy-MM-dd")
      .split("-")
      .map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    base.setUTCDate(base.getUTCDate() + delta);
    const dateStr = `${base.getUTCFullYear()}-${String(
      base.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;
    router.push(`/admin/shifts?date=${dateStr}&location=${selectedLocation}`);
  };

  return (
    <ShiftCalendar
      selectedDate={selectedDate}
      selectedLocation={selectedLocation}
      shiftSummaries={shiftSummaries}
      onDateSelect={handleDateSelect}
      onStep={handleStep}
    />
  );
}
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

  // Location names are free text, so they have to be encoded rather than
  // interpolated straight into the query string.
  const shiftsHref = (dateStr: string) =>
    `/admin/shifts?date=${dateStr}&location=${encodeURIComponent(
      selectedLocation
    )}`;

  const handleDateSelect = (date: Date) => {
    router.push(shiftsHref(formatInNZT(date, "yyyy-MM-dd")));
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
    router.push(shiftsHref(dateStr));
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
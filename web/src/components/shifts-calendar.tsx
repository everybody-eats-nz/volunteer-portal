"use client";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { formatInNZT } from "@/lib/timezone";
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarList } from "@/components/ui/avatar-list";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChefHat,
  ConciergeBell,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  dayThemeLabel,
  type ShiftDayTheme,
  type ShiftDayThemeMap,
} from "@/lib/shift-day-themes";
import type { DayLeads, DayLeadsMap } from "@/lib/day-leads";
import { Sparkle } from "@/components/sparkle";

/**
 * The month's themed and closed days written out in full, for phones and
 * tablets - where calendar cells only have room to mark the date. Days with
 * shifts link through to them.
 */
function ThemedDayList({
  location,
  themes,
  days,
}: {
  location: string;
  themes: Record<string, ShiftDayTheme> | undefined;
  days: Array<{ date: Date; shifts: unknown[] }>;
}) {
  if (!themes || days.length === 0) return null;

  return (
    <ul
      className="mt-3 border-t border-forest-500/10 pt-2 sm:mt-5 sm:pt-3 lg:hidden dark:border-cream-50/10"
      aria-label="Themed and closed days"
      data-testid="calendar-day-theme-list"
    >
      {days.map((day) => {
        const key = format(day.date, "yyyy-MM-dd");
        const { theme, closed } = themes[key];
        const row = (
          <>
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                closed
                  ? "closed-hatch border border-forest-500/15 text-forest-700/70 line-through decoration-forest-700/45 dark:border-cream-50/15 dark:text-cream-50/50 dark:decoration-cream-50/40"
                  : "bg-sun-200 text-forest-800 dark:bg-sun-200/20 dark:text-sun-100"
              )}
            >
              {format(day.date, "d")}
            </span>
            <span className="w-8 shrink-0 text-xs font-semibold text-forest-700/70 dark:text-cream-50/55">
              {format(day.date, "EEE")}
            </span>
            {closed ? (
              <span
                className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2"
                data-testid={`calendar-day-closed-${key}`}
              >
                <span className="text-sm font-semibold text-forest-800 dark:text-cream-50">
                  Closed
                </span>
                {theme && (
                  <span className="display min-w-0 text-base italic leading-snug text-forest-700/80 dark:text-cream-50/75">
                    {theme}
                  </span>
                )}
              </span>
            ) : (
              <span className="display min-w-0 flex-1 text-base italic leading-snug text-forest-800 dark:text-cream-50">
                {theme}
              </span>
            )}
          </>
        );
        return (
          <li key={key}>
            {day.shifts.length > 0 ? (
              <Link
                href={`/shifts/details?date=${key}&location=${encodeURIComponent(
                  location
                )}`}
                className="flex min-h-11 items-center gap-2 rounded-xl px-1 py-1.5 transition-colors active:bg-forest-500/5"
              >
                {row}
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-forest-500/85 dark:text-cream-50/55"
                  aria-hidden
                />
              </Link>
            ) : (
              <div className="flex min-h-11 items-center gap-2 px-1 py-1.5">
                {row}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The Chef and FOH Manager by first name, tucked under a day's availability.
 * Wide screens only - narrower cells have no room, and the day's page lists
 * them in full.
 */
function DayLeadsLine({ dayKey, leads }: { dayKey: string; leads: DayLeads }) {
  const roles = [
    { label: "Chef", name: leads.chef, Icon: ChefHat },
    { label: "FOH Manager", name: leads.fohManager, Icon: ConciergeBell },
  ].filter((role) => role.name);

  return (
    <ul
      className="hidden w-full min-w-0 flex-col items-center gap-px text-[11px] leading-tight text-forest-700/75 lg:flex dark:text-cream-50/70"
      data-testid={`calendar-day-leads-${dayKey}`}
    >
      {roles.map(({ label, name, Icon }) => (
        <li
          key={label}
          className="flex max-w-full min-w-0 items-center gap-1"
          title={`${label}: ${name}`}
        >
          <Icon
            className="h-3 w-3 shrink-0 text-forest-500/85 dark:text-cream-50/50"
            aria-hidden
          />
          <span className="sr-only">{label}:</span>
          <span className="truncate font-medium">{name}</span>
        </li>
      ))}
    </ul>
  );
}

interface ShiftSummary {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  capacity: number;
  confirmedCount: number;
  pendingCount: number;
  shiftType: {
    name: string;
    description: string | null;
  };
  friendSignups?: Array<{
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      email: string;
      profilePhotoUrl: string | null;
    };
    isFriend: boolean;
  }>;
}

interface ShiftsCalendarProps {
  shifts: ShiftSummary[];
  /**
   * Admin-set themes ("Christmas Lunch", "Pasta Night") and closures for
   * upcoming days, keyed by location then "yyyy-MM-dd" NZ day.
   */
  dayThemes?: ShiftDayThemeMap;
  /**
   * The Chef and FOH Manager running each day, by first name, keyed by
   * location then "yyyy-MM-dd" NZ day.
   */
  dayLeads?: DayLeadsMap;
  selectedLocation?: string;
  /**
   * Server-rendered "now" as an epoch-ms timestamp. Seeding all time-dependent
   * state from a single server-provided value keeps the SSR output and the
   * client hydration render identical, avoiding React #418 hydration mismatches
   * when the server's clock and the client's clock straddle a day/month boundary.
   */
  serverNow: number;
  /**
   * Month the calendar opens on, as "yyyy-MM". Usually the current month, but
   * the server falls through to the month of the next shift when the current
   * one has none left, so volunteers never land on an empty grid. Passed as a
   * plain year-month string rather than a timestamp because a start-of-month
   * instant would resolve to the previous month for viewers behind NZ time,
   * desyncing hydration from the SSR output.
   */
  initialMonth: string;
}

interface DayShifts {
  date: Date;
  shifts: ShiftSummary[];
  totalCapacity: number;
  totalConfirmed: number;
  totalPending: number;
  spotsAvailable: number;
  allFriendSignups: Array<{
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      email: string;
      profilePhotoUrl: string | null;
    };
    isFriend: boolean;
  }>;
}

export function ShiftsCalendar({
  shifts,
  dayThemes = {},
  dayLeads = {},
  selectedLocation,
  serverNow,
  initialMonth,
}: ShiftsCalendarProps) {
  // All "now"-derived values come from the server timestamp so the initial
  // client render matches the SSR output exactly (prevents hydration errors).
  const [currentMonth, setCurrentMonth] = useState(() => {
    const [year, month] = initialMonth.split("-").map(Number);
    return new Date(year, month - 1, 1);
  });

  // Every day comparison below is done on "yyyy-MM-dd" keys resolved in
  // Pacific/Auckland, never on the viewer's local calendar. A shift instant maps
  // to a different local day for anyone off NZ time (a 5:30pm NZ shift is the
  // previous day in UTC), which used to move it into a different grid cell on the
  // client than on the server — and since a cell with shifts renders a <Link>
  // while an empty or past one renders a plain <div>, that produced an
  // element-level React #418 hydration mismatch. NZ keys are identical in every
  // timezone, so server and client always agree.
  const todayKey = formatInNZT(new Date(serverNow), "yyyy-MM-dd");
  const thisMonthKey = todayKey.slice(0, 7);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Create a proper calendar grid that starts with Sunday and includes padding days
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // Group shifts by restaurant location
  const shiftsByLocation = shifts.reduce((acc, shift) => {
    const location = shift.location || "TBD";
    if (!acc[location]) acc[location] = [];
    acc[location].push(shift);
    return acc;
  }, {} as Record<string, ShiftSummary[]>);

  const locations = Object.keys(shiftsByLocation).sort();

  // Group shifts by date for each location
  const getLocationDayShifts = (location: string): DayShifts[] => {
    const locationShifts = shiftsByLocation[location] || [];

    // Bucket each shift by the NZ calendar day it starts on, once, so the grid
    // lookup below is a key match rather than a per-cell scan.
    const shiftsByDayKey = new Map<string, ShiftSummary[]>();
    for (const shift of locationShifts) {
      const key = formatInNZT(shift.start, "yyyy-MM-dd");
      const bucket = shiftsByDayKey.get(key);
      if (bucket) bucket.push(shift);
      else shiftsByDayKey.set(key, [shift]);
    }

    return calendarDays.map((date) => {
      // Grid cells are built from plain year/month/day components, so their
      // "yyyy-MM-dd" label is the same in every timezone.
      const dayKey = format(date, "yyyy-MM-dd");
      const dayShifts = shiftsByDayKey.get(dayKey) ?? [];

      const totalCapacity = dayShifts.reduce((sum, s) => sum + s.capacity, 0);
      const totalConfirmed = dayShifts.reduce(
        (sum, s) => sum + s.confirmedCount,
        0
      );
      const totalPending = dayShifts.reduce(
        (sum, s) => sum + s.pendingCount,
        0
      );
      const spotsAvailable = Math.max(
        0,
        totalCapacity - totalConfirmed - totalPending
      );

      // Collect all friend signups for this day, de-duplicated by user ID
      // If a user is signed up for multiple shifts, they only appear once
      // Prioritize showing them as a friend if any signup marks them as such
      const signupsByUserId = new Map<
        string,
        NonNullable<(typeof dayShifts)[0]["friendSignups"]>[0]
      >();
      dayShifts.forEach((shift) => {
        if (shift.friendSignups) {
          shift.friendSignups.forEach((signup) => {
            const existing = signupsByUserId.get(signup.user.id);
            if (!existing) {
              signupsByUserId.set(signup.user.id, signup);
            } else if (signup.isFriend && !existing.isFriend) {
              // If this signup marks the user as a friend, prefer it
              signupsByUserId.set(signup.user.id, signup);
            }
          });
        }
      });
      // Sort to show friends first
      const allFriendSignups = Array.from(signupsByUserId.values()).sort(
        (a, b) => (b.isFriend ? 1 : 0) - (a.isFriend ? 1 : 0)
      );

      return {
        date,
        shifts: dayShifts,
        totalCapacity,
        totalConfirmed,
        totalPending,
        spotsAvailable,
        allFriendSignups: allFriendSignups || [],
      };
    });
  };

  const getDayStatus = (dayShifts: DayShifts) => {
    if (dayShifts.shifts.length === 0) return "none";
    if (dayShifts.spotsAvailable === 0) return "full";
    if (dayShifts.spotsAvailable <= 2) return "limited";
    return "available";
  };

  /**
   * Availability styling in the marketing palette. Colour lives in a compact
   * dot + chip rather than a full-cell fill, so the month reads calm and
   * editorial while still being scannable: forest = plenty, sun = few left,
   * hollow outline = full (waitlist).
   */
  const statusMeta = (status: string, spots: number) => {
    switch (status) {
      case "available":
        return {
          label: `${spots} open`,
          spoken: `${spots} ${spots === 1 ? "spot" : "spots"} open`,
          dot: "bg-forest-500",
          chip: "bg-forest-500/10 text-forest-700 dark:bg-forest-400/20 dark:text-cream-50",
        };
      case "limited":
        return {
          label: `${spots} left`,
          spoken: `only ${spots} ${spots === 1 ? "spot" : "spots"} left`,
          dot: "bg-sun-300",
          chip: "bg-sun-200/70 text-forest-800 dark:bg-sun-300/15 dark:text-sun-100",
        };
      case "full":
        return {
          label: "Waitlist",
          spoken: "full, join the waitlist",
          dot: "ring-1 ring-inset ring-forest-500/50 dark:ring-cream-50/40",
          chip: "bg-forest-500/[0.06] text-forest-700/70 dark:bg-cream-50/10 dark:text-cream-50/65",
        };
      default:
        return { label: "", spoken: "", dot: "", chip: "" };
    }
  };

  const previousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
  };

  // Show only selected location if filter is applied
  const displayLocations = selectedLocation
    ? locations.filter((loc) => loc === selectedLocation)
    : locations;

  // Check if any display locations have shifts in the current month
  const hasAnyShiftsInMonth = displayLocations.some((location) => {
    const locationDayShifts = getLocationDayShifts(location);
    return locationDayShifts.some((day) => day.shifts.length > 0);
  });

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-forest-500 dark:bg-forest-600 rounded-xl flex items-center justify-center text-cream-50 shadow-lg flex-shrink-0">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="display text-xl sm:text-3xl tracking-tight text-forest-700 dark:text-cream-50">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <p className="text-sm text-forest-700/70 dark:text-cream-50/55 hidden sm:block">
              Click any date to view and sign up for shifts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={previousMonth}
            disabled={format(currentMonth, "yyyy-MM") <= thisMonthKey}
            data-testid="calendar-prev-month"
            aria-label="Previous month"
            className="h-9 w-9 rounded-full border-forest-500/25 text-forest-700 transition-colors hover:border-forest-500 hover:bg-forest-500 hover:text-cream-50 disabled:opacity-40 dark:border-cream-50/20 dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            data-testid="calendar-next-month"
            aria-label="Next month"
            className="h-9 w-9 rounded-full border-forest-500/25 text-forest-700 transition-colors hover:border-forest-500 hover:bg-forest-500 hover:text-cream-50 dark:border-cream-50/20 dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendars by Restaurant */}
      <div className="space-y-8">
        {displayLocations.map((location) => {
          const locationDayShifts = getLocationDayShifts(location);
          const hasAnyShifts = locationDayShifts.some(
            (day) => day.shifts.length > 0
          );

          if (!hasAnyShifts) return null;

          return (
            <Card
              key={location}
              className="overflow-hidden py-0"
              data-testid={`calendar-${location
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
            >
              {/* Only show location header when displaying multiple locations */}
              {!selectedLocation && (
                <div className="bg-forest-500/5 dark:bg-forest-700/30 px-6 py-4 border-b border-forest-500/10 dark:border-cream-50/10">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest-500/10 text-forest-500 dark:bg-cream-50/10 dark:text-cream-50/80">
                      <MapPin className="h-5 w-5" />
                    </span>
                    <h3 className="display text-lg sm:text-xl tracking-tight text-forest-700 dark:text-cream-50">
                      {location}
                    </h3>
                  </div>
                </div>
              )}

              <CardContent className="p-2 sm:p-6">
                {/* Days of week header */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-4">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day, i) => (
                      <div
                        key={day}
                        className="text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-forest-700/70 dark:text-cream-50/55 py-1 sm:py-2"
                      >
                        <span className="sm:hidden">{["S", "M", "T", "W", "T", "F", "S"][i]}</span>
                        <span className="hidden sm:inline">{day}</span>
                      </div>
                    )
                  )}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {locationDayShifts.map((dayShifts, index) => {
                    const status = getDayStatus(dayShifts);
                    const isCurrentMonth = isSameMonth(
                      dayShifts.date,
                      currentMonth
                    );
                    // ISO day keys sort lexicographically, so string comparison
                    // is the same as date comparison — and stays in NZ days.
                    const dayKey = format(dayShifts.date, "yyyy-MM-dd");
                    const isPastDate = dayKey < todayKey;
                    const isToday = dayKey === todayKey;

                    const meta = statusMeta(status, dayShifts.spotsAvailable);
                    const isInteractive =
                      isCurrentMonth && !isPastDate && status !== "none";
                    const dayTheme =
                      isCurrentMonth && !isPastDate
                        ? dayThemes[location]?.[dayKey]
                        : undefined;
                    const isClosed = dayTheme?.closed === true;
                    // The theme text, or on a closed day the reason (if any)
                    const theme = dayTheme?.theme || undefined;
                    const leads = isInteractive
                      ? dayLeads[location]?.[dayKey]
                      : undefined;

                    const dayContent = (
                      <div
                        className={cn(
                          "group relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-2xl p-1 transition-all duration-300 sm:justify-start sm:gap-0 sm:p-2.5",
                          !isCurrentMonth && "opacity-40",
                          isCurrentMonth &&
                            isPastDate &&
                            "border border-forest-500/10 bg-forest-500/[0.03] opacity-55 dark:border-cream-50/10 dark:bg-forest-900/30",
                          isCurrentMonth &&
                            !isPastDate &&
                            isToday &&
                            "border-2 border-forest-500 bg-sun-100/60 shadow-sm dark:border-forest-400 dark:bg-forest-700/40",
                          isCurrentMonth &&
                            !isPastDate &&
                            isToday &&
                            isInteractive &&
                            "cursor-pointer hover:shadow-lg motion-safe:hover:-translate-y-0.5",
                          isCurrentMonth &&
                            !isPastDate &&
                            !isToday &&
                            status === "none" &&
                            "border border-forest-500/10 bg-card dark:border-cream-50/10 dark:bg-forest-800/40",
                          isClosed && "closed-hatch",
                          isInteractive &&
                            !isToday &&
                            "cursor-pointer border border-forest-500/15 bg-card shadow-sm motion-safe:hover:-translate-y-0.5 hover:border-forest-500/50 hover:shadow-lg dark:border-cream-50/10 dark:bg-forest-800/50 dark:hover:border-forest-400/50"
                        )}
                        data-testid={`calendar-day-${dayKey}`}
                        data-closed={isClosed || undefined}
                        title={dayTheme ? dayThemeLabel(dayTheme) : undefined}
                      >
                        {/* Date number — centered at the top of the tile, with
                            the day's theme beside it on wide screens */}
                        <div
                          className={cn(
                            "flex shrink-0 items-start",
                            dayTheme && "lg:w-full lg:gap-1.5"
                          )}
                        >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors",
                            // Narrower screens have no room for the theme text,
                            // so the number itself is highlighted and the
                            // themes are listed in full beneath the grid.
                            theme &&
                              !isClosed &&
                              !isToday &&
                              "max-lg:bg-sun-200 max-lg:text-forest-800 dark:max-lg:bg-sun-200/20 dark:max-lg:text-sun-100",
                            // A closed day's number is struck through - the
                            // one mark that reads at every cell size.
                            isClosed &&
                              "line-through decoration-forest-700/45 decoration-[1.5px] dark:decoration-cream-50/45",
                            !isCurrentMonth &&
                              "text-forest-700/35 dark:text-cream-50/30",
                            isCurrentMonth &&
                              isPastDate &&
                              "text-forest-700/45 dark:text-cream-50/40",
                            isCurrentMonth &&
                              !isPastDate &&
                              isToday &&
                              "bg-forest-500 text-cream-50 shadow-sm shadow-forest-500/30",
                            isCurrentMonth &&
                              !isPastDate &&
                              !isToday &&
                              (isClosed
                                ? "text-forest-700/70 dark:text-cream-50/50"
                                : "text-forest-700 dark:text-cream-50/85")
                          )}
                        >
                          {format(dayShifts.date, "d")}
                        </span>
                        {isClosed && (
                          <span
                            className="hidden min-w-0 pt-[3px] text-left lg:block"
                            data-testid={`calendar-day-closed-label-${dayKey}`}
                          >
                            <span className="block text-[13px] font-semibold leading-[1.2] text-forest-800 dark:text-cream-50">
                              Closed
                            </span>
                            {theme && (
                              <span className="display mt-0.5 line-clamp-2 text-[13px] italic leading-[1.2] text-forest-700/75 dark:text-cream-50/70">
                                {theme}
                              </span>
                            )}
                          </span>
                        )}
                        {theme && !isClosed && (
                          <span
                            className="hidden min-w-0 pt-[3px] text-left lg:block"
                            data-testid={`calendar-day-theme-${dayKey}`}
                          >
                            <span className="display line-clamp-2 text-[13px] italic leading-[1.2] text-forest-800 dark:text-sun-100">
                              <span className="box-decoration-clone rounded-[3px] bg-sun-200/80 px-1 dark:bg-sun-200/20">
                                {theme}
                              </span>
                            </span>
                          </span>
                        )}
                        </div>

                        {/* Mobile: a small availability dot under the number */}
                        {isInteractive && (
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full sm:hidden",
                              meta.dot
                            )}
                            aria-hidden
                          />
                        )}

                        {/* Desktop: availability chip + volunteer avatars,
                            centered in the space beneath the number */}
                        <div className="hidden flex-1 flex-col items-center justify-center gap-1.5 sm:flex">
                          {isInteractive ? (
                            <>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  meta.chip
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    meta.dot
                                  )}
                                  aria-hidden
                                />
                                {meta.label}
                              </span>
                              {/* Links stay off - the whole cell is already a
                                  link to the day's shifts, and an <a> inside an
                                  <a> is invalid HTML that the browser re-parses,
                                  breaking hydration. Friend profiles stay
                                  reachable from the shift detail page. Tablet
                                  cells are too short for the avatars under the
                                  chip, so they start at lg. */}
                              {dayShifts.totalConfirmed > 0 && (
                                <AvatarList
                                  className="hidden lg:flex"
                                  users={dayShifts.allFriendSignups.map(
                                    (signup) => signup.user
                                  )}
                                  maxDisplay={2}
                                  size="sm"
                                  totalCount={dayShifts.totalConfirmed}
                                  enableLinks={false}
                                />
                              )}
                              {leads && (
                                <DayLeadsLine dayKey={dayKey} leads={leads} />
                              )}
                            </>
                          ) : isCurrentMonth && !isPastDate && isToday ? (
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-forest-700/70 dark:text-cream-50/60">
                              Today
                            </span>
                          ) : isCurrentMonth && !isPastDate && !dayTheme ? (
                            <span
                              className="h-1 w-1 rounded-full bg-forest-500/25 dark:bg-cream-50/20"
                              aria-hidden
                            />
                          ) : null}
                        </div>
                      </div>
                    );

                    return (
                      <div key={index}>
                        {dayShifts.shifts.length > 0 &&
                        isCurrentMonth &&
                        !isPastDate ? (
                          <Link
                            href={`/shifts/details?date=${dayKey}&location=${encodeURIComponent(
                              location
                            )}`}
                            className="block rounded-2xl"
                            aria-label={[
                              format(dayShifts.date, "EEEE d MMMM"),
                              isToday ? "today" : null,
                              meta.spoken || null,
                              theme ?? null,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          >
                            {dayContent}
                          </Link>
                        ) : (
                          dayContent
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Key for the Chef / FOH Manager icons in the cells */}
                {Object.keys(dayLeads[location] ?? {}).some((key) =>
                  key.startsWith(format(currentMonth, "yyyy-MM"))
                ) && (
                  <p
                    className="mt-4 hidden items-center justify-end gap-4 text-xs text-forest-700/70 lg:flex dark:text-cream-50/55"
                    data-testid="calendar-day-leads-key"
                  >
                    <span className="flex items-center gap-1.5">
                      <ChefHat className="h-3.5 w-3.5" aria-hidden />
                      Chef
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ConciergeBell className="h-3.5 w-3.5" aria-hidden />
                      FOH Manager
                    </span>
                  </p>
                )}

                {/* Below lg the cells only highlight themed days, so spell
                    the themes out here */}
                <ThemedDayList
                  location={location}
                  themes={dayThemes[location]}
                  days={locationDayShifts.filter((day) => {
                    const key = format(day.date, "yyyy-MM-dd");
                    return (
                      isSameMonth(day.date, currentMonth) &&
                      key >= todayKey &&
                      Boolean(dayThemes[location]?.[key])
                    );
                  })}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!hasAnyShiftsInMonth && (
        <Card className="grain border-forest-500/10 dark:border-cream-50/10 rounded-3xl">
          <CardContent className="py-14 text-center" data-testid="empty-state">
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div className="w-16 h-16 bg-forest-500/10 dark:bg-cream-50/10 rounded-2xl flex items-center justify-center">
                <Calendar className="w-8 h-8 text-forest-500 dark:text-cream-50/70" />
              </div>
              <Sparkle className="absolute -right-2 -top-2 h-5 w-5 text-sun-300" />
            </div>
            <h3
              className="display text-2xl tracking-tight text-forest-700 dark:text-cream-50 mb-2"
              data-testid="empty-state-title"
            >
              No shifts scheduled
            </h3>
            <p
              className="text-forest-700/70 dark:text-cream-50/70 mb-4 max-w-md mx-auto"
              data-testid="empty-state-description"
            >
              {selectedLocation
                ? `No shifts found for ${selectedLocation} in ${format(
                    currentMonth,
                    "MMMM yyyy"
                  )}.`
                : `No shifts are currently scheduled for ${format(
                    currentMonth,
                    "MMMM yyyy"
                  )}.`}
            </p>
            <p className="text-sm text-forest-700/70 dark:text-cream-50/55">
              {format(currentMonth, "yyyy-MM") > thisMonthKey
                ? "Shifts are usually published closer to the date."
                : format(currentMonth, "yyyy-MM") < thisMonthKey
                ? "This month has passed. Try viewing current or future months."
                : "Check back soon for upcoming shifts, or try a different location."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

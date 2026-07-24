"use client";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarList } from "@/components/ui/avatar-list";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
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
  selectedLocation?: string;
  /**
   * Server-rendered "now" as an epoch-ms timestamp. Seeding all time-dependent
   * state from a single server-provided value keeps the SSR output and the
   * client hydration render identical, avoiding React #418 hydration mismatches
   * when the server's clock and the client's clock straddle a day/month boundary.
   */
  serverNow: number;
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
  selectedLocation,
  serverNow,
}: ShiftsCalendarProps) {
  // All "now"-derived values come from the server timestamp so the initial
  // client render matches the SSR output exactly (prevents hydration errors).
  const [currentMonth, setCurrentMonth] = useState(() => new Date(serverNow));

  // Stable references to "now" for the initial render.
  const nowDate = new Date(serverNow);
  const todayMidnight = new Date(serverNow);
  todayMidnight.setHours(0, 0, 0, 0);

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

    return calendarDays.map((date) => {
      const dayShifts = locationShifts.filter((shift) =>
        isSameDay(shift.start, date)
      );

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
          dot: "bg-forest-500",
          chip: "bg-forest-500/10 text-forest-700 dark:bg-forest-400/20 dark:text-cream-50",
        };
      case "limited":
        return {
          label: `${spots} left`,
          dot: "bg-sun-300",
          chip: "bg-sun-200/70 text-forest-800 dark:bg-sun-300/15 dark:text-sun-100",
        };
      case "full":
        return {
          label: "Waitlist",
          dot: "ring-1 ring-inset ring-forest-500/50 dark:ring-cream-50/40",
          chip: "bg-forest-500/[0.06] text-forest-700/65 dark:bg-cream-50/10 dark:text-cream-50/65",
        };
      default:
        return { label: "", dot: "", chip: "" };
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
            <p className="text-sm text-forest-700/60 dark:text-cream-50/55 hidden sm:block">
              Click any date to view and sign up for shifts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={previousMonth}
            disabled={
              format(currentMonth, "yyyy-MM") <= format(nowDate, "yyyy-MM")
            }
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
                        className="text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-forest-700/50 dark:text-cream-50/45 py-1 sm:py-2"
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
                    const today = todayMidnight;
                    const dayStart = new Date(dayShifts.date);
                    dayStart.setHours(0, 0, 0, 0);
                    const isPastDate = dayStart < today;
                    const isToday = isSameDay(dayShifts.date, today);

                    const meta = statusMeta(status, dayShifts.spotsAvailable);
                    const isInteractive =
                      isCurrentMonth && !isPastDate && status !== "none";

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
                            "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
                          isCurrentMonth &&
                            !isPastDate &&
                            !isToday &&
                            status === "none" &&
                            "border border-forest-500/10 bg-card dark:border-cream-50/10 dark:bg-forest-800/40",
                          isInteractive &&
                            !isToday &&
                            "cursor-pointer border border-forest-500/15 bg-card shadow-sm hover:-translate-y-0.5 hover:border-forest-500/50 hover:shadow-lg dark:border-cream-50/10 dark:bg-forest-800/50 dark:hover:border-forest-400/50"
                        )}
                        data-testid={`calendar-day-${format(
                          dayShifts.date,
                          "yyyy-MM-dd"
                        )}`}
                      >
                        {/* Date number — centered at the top of the tile */}
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors",
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
                              "text-forest-700 dark:text-cream-50/85"
                          )}
                        >
                          {format(dayShifts.date, "d")}
                        </span>

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
                              {dayShifts.totalConfirmed > 0 && (
                                <AvatarList
                                  users={dayShifts.allFriendSignups.map(
                                    (signup) => signup.user
                                  )}
                                  maxDisplay={2}
                                  size="sm"
                                  totalCount={dayShifts.totalConfirmed}
                                  enableLinks={(user) => {
                                    const signup =
                                      dayShifts.allFriendSignups.find(
                                        (s) => s.user.id === user.id
                                      );
                                    return signup?.isFriend ?? false;
                                  }}
                                />
                              )}
                            </>
                          ) : isCurrentMonth && !isPastDate && isToday ? (
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-forest-700/70 dark:text-cream-50/60">
                              Today
                            </span>
                          ) : isCurrentMonth && !isPastDate ? (
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
                            href={`/shifts/details?date=${format(
                              dayShifts.date,
                              "yyyy-MM-dd"
                            )}&location=${encodeURIComponent(location)}`}
                            className="block"
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
            <p className="text-sm text-forest-700/55 dark:text-cream-50/55">
              {format(currentMonth, "yyyy-MM") > format(nowDate, "yyyy-MM")
                ? "Shifts are usually published closer to the date."
                : format(currentMonth, "yyyy-MM") <
                  format(nowDate, "yyyy-MM")
                ? "This month has passed. Try viewing current or future months."
                : "Check back soon for upcoming shifts, or try a different location."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

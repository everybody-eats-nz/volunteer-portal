import { prisma } from "@/lib/prisma";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  differenceInHours,
  startOfWeek,
  endOfWeek,
  isSameMonth,
} from "date-fns";
import { formatInNZT, getStartOfDayUTC, isSameDayInNZT } from "@/lib/timezone";
import { safeParseAvailability } from "@/lib/parse-availability";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedStatsGrid } from "@/components/animated-stats-grid";
import { Button } from "@/components/ui/button";
import { ShiftDetailsDialog } from "./shift-details-dialog";
import { StatusBadge } from "./status-badge";
import { getShiftTheme } from "@/lib/shift-themes";
import {
  Calendar,
  Timer,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
} from "lucide-react";

// Export the shift signup type for use by ShiftDetailsDialog
export type ShiftSignup = Awaited<ReturnType<typeof fetchMonthShifts>>[number];

async function fetchMonthShifts(
  userId: string,
  monthStart: Date,
  monthEnd: Date,
  userFriendIds: string[]
) {
  return prisma.signup.findMany({
    where: {
      userId,
      status: { not: "CANCELED" },
      shift: {
        start: { gte: monthStart, lte: monthEnd },
      },
    },
    select: {
      id: true,
      userId: true,
      shiftId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      shift: {
        include: {
          shiftType: true,
          signups: {
            where:
              userFriendIds.length > 0
                ? {
                    userId: { in: userFriendIds },
                    status: {
                      in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"],
                    },
                  }
                : {
                    id: { equals: "never-match" },
                  },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  profilePhotoUrl: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

interface MyShiftsContentProps {
  userId: string;
  monthParam?: string;
}

export async function MyShiftsContent({
  userId,
  monthParam,
}: MyShiftsContentProps) {
  const now = new Date();
  const startOfTodayNZ = getStartOfDayUTC(now);

  // Parse month/year for calendar navigation
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const viewMonth = monthParam
    ? new Date(parseInt(monthParam))
    : currentMonth;

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);

  // Get current user's profile for preferences
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      availableLocations: true,
    },
  });

  const userPreferredLocations = safeParseAvailability(
    currentUser?.availableLocations
  );

  // Get user's friend IDs
  const userFriendIds = await prisma.friendship
    .findMany({
      where: {
        AND: [
          {
            OR: [{ userId: userId }, { friendId: userId }],
          },
          { status: "ACCEPTED" },
        ],
      },
      select: {
        userId: true,
        friendId: true,
      },
    })
    .then((friendships) =>
      friendships.map((friendship) =>
        friendship.userId === userId ? friendship.friendId : friendship.userId
      )
    );

  // Fetch all data in parallel
  const [allShifts, monthShifts, totalStats, availableShifts] =
    await Promise.all([
      // All shifts for overall stats
      prisma.signup.findMany({
        where: {
          userId,
          status: { not: "CANCELED" },
        },
        select: {
          id: true,
          userId: true,
          shiftId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          shift: {
            include: {
              shiftType: true,
              signups: {
                where:
                  userFriendIds.length > 0
                    ? {
                        userId: { in: userFriendIds },
                        status: {
                          in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"],
                        },
                      }
                    : {
                        id: { equals: "never-match" },
                      },
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      profilePhotoUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { shift: { start: "asc" } },
      }),
      // Month shifts
      fetchMonthShifts(userId, monthStart, monthEnd, userFriendIds),
      // Count stats
      Promise.all([
        prisma.signup.count({
          where: {
            userId,
            shift: { end: { lt: now } },
            status: "CONFIRMED",
          },
        }),
        prisma.signup.count({
          where: {
            userId,
            shift: { start: { gte: now } },
            status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
          },
        }),
      ]),
      // Available shifts in user's preferred locations
      userPreferredLocations.length > 0
        ? prisma.shift.findMany({
            where: {
              start: {
                gte: now > monthStart ? now : monthStart,
                lte: monthEnd,
              },
              location: { in: userPreferredLocations },
              signups: {
                none: {
                  userId: userId,
                  status: { not: "CANCELED" },
                },
              },
            },
            include: {
              signups: {
                where: {
                  status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
                },
              },
              shiftType: true,
            },
          })
        : Promise.resolve([]),
    ]);

  const [completedShifts, upcomingShifts] = totalStats;

  // Generate calendar days with proper week alignment
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // Group shifts by date
  const shiftsByDate = new Map<string, typeof monthShifts>();
  for (const shift of monthShifts) {
    const dateKey = formatInNZT(shift.shift.start, "yyyy-MM-dd");
    if (!shiftsByDate.has(dateKey)) {
      shiftsByDate.set(dateKey, []);
    }
    shiftsByDate.get(dateKey)!.push(shift);
  }

  // Group available shifts by date
  type AvailableShift = typeof availableShifts extends readonly (infer T)[]
    ? T
    : never;
  const availableShiftsByDate = new Map<string, AvailableShift[]>();
  for (const shift of availableShifts) {
    const dateKey = formatInNZT(shift.start, "yyyy-MM-dd");
    if (!availableShiftsByDate.has(dateKey)) {
      availableShiftsByDate.set(dateKey, []);
    }
    const confirmedSignups = shift.signups.filter(
      (s) => s.status === "CONFIRMED"
    ).length;
    const pendingSignups = shift.signups.filter(
      (s) => s.status === "PENDING" || s.status === "REGULAR_PENDING"
    ).length;
    const hasAvailableSpots =
      confirmedSignups + pendingSignups < shift.capacity;

    if (hasAvailableSpots) {
      availableShiftsByDate.get(dateKey)!.push(shift);
    }
  }

  const prevMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() - 1,
    1
  );
  const nextMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    1
  );

  return (
    <>
      {/* Stats Overview */}
      <div data-testid="stats-overview">
        <AnimatedStatsGrid
          useStatsGrid={false}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          stats={[
            {
              title: "Completed",
              value: completedShifts,
              iconType: "checkCircle",
              variant: "green",
              testId: "completed-shifts-card",
            },
            {
              title: "Upcoming",
              value: upcomingShifts,
              iconType: "calendar",
              variant: "blue",
              testId: "upcoming-shifts-card",
            },
            {
              title: "Shifts This Month",
              value: monthShifts.length,
              iconType: "timer",
              variant: "purple",
              testId: "this-month-shifts-card",
            },
            {
              title: "Total Hours",
              value: Math.round(
                allShifts
                  .filter((s) => s.shift.end < now && s.status === "CONFIRMED")
                  .reduce(
                    (total, s) =>
                      total + differenceInHours(s.shift.end, s.shift.start),
                    0
                  )
              ),
              iconType: "timer",
              variant: "amber",
              testId: "total-hours-card",
            },
          ]}
        />
      </div>

      {/* Schedule View */}
      <Card data-testid="calendar-view">
        <CardHeader className="pb-4">
          {/* Mobile Header Layout */}
          <div className="sm:hidden">
            <CardTitle className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div
                  className="text-xl font-bold"
                  data-testid="mobile-calendar-title"
                >
                  {format(viewMonth, "MMMM yyyy")}
                </div>
                <div
                  className="text-sm text-muted-foreground font-normal"
                  data-testid="mobile-calendar-description"
                >
                  Your volunteer schedule
                </div>
              </div>
            </CardTitle>
            <div
              className="flex items-center justify-center gap-1.5"
              data-testid="mobile-calendar-navigation"
            >
              <Button
                variant="outline"
                size="sm"
                asChild
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors flex-1 h-8 px-2 text-xs"
                data-testid="mobile-prev-month-button"
              >
                <Link
                  href={{
                    pathname: "/shifts/mine",
                    query: { month: prevMonth.getTime().toString() },
                  }}
                  className="flex items-center justify-center"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Previous
                </Link>
              </Button>

              {viewMonth.getMonth() !== currentMonth.getMonth() ||
              viewMonth.getFullYear() !== currentMonth.getFullYear() ? (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 h-8 px-2 text-xs"
                  data-testid="mobile-today-button"
                >
                  <Link href="/shifts/mine">Today</Link>
                </Button>
              ) : null}

              <Button
                variant="outline"
                size="sm"
                asChild
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors flex-1 h-8 px-2 text-xs"
                data-testid="mobile-next-month-button"
              >
                <Link
                  href={{
                    pathname: "/shifts/mine",
                    query: { month: nextMonth.getTime().toString() },
                  }}
                  className="flex items-center justify-center"
                >
                  Next
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Desktop Header Layout */}
          <div className="hidden sm:flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold" data-testid="calendar-title">
                  {format(viewMonth, "MMMM yyyy")}
                </div>
                <div
                  className="text-sm text-muted-foreground font-normal"
                  data-testid="calendar-description"
                >
                  Your volunteer schedule
                </div>
              </div>
            </CardTitle>
            <div
              className="flex items-center gap-2"
              data-testid="calendar-navigation"
            >
              <Button
                variant="outline"
                size="sm"
                asChild
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors"
                data-testid="prev-month-button"
              >
                <Link
                  href={{
                    pathname: "/shifts/mine",
                    query: { month: prevMonth.getTime().toString() },
                  }}
                  className="flex items-center"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="ml-1">Prev</span>
                </Link>
              </Button>

              {viewMonth.getMonth() !== currentMonth.getMonth() ||
              viewMonth.getFullYear() !== currentMonth.getFullYear() ? (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
                  data-testid="today-button"
                >
                  <Link href="/shifts/mine">Today</Link>
                </Button>
              ) : null}

              <Button
                variant="outline"
                size="sm"
                asChild
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors"
                data-testid="next-month-button"
              >
                <Link
                  href={{
                    pathname: "/shifts/mine",
                    query: { month: nextMonth.getTime().toString() },
                  }}
                  className="flex items-center"
                >
                  <span className="mr-1">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Desktop Calendar Grid */}
          <DesktopCalendarGrid
            calendarDays={calendarDays}
            shiftsByDate={shiftsByDate}
            availableShiftsByDate={availableShiftsByDate}
            viewMonth={viewMonth}
            now={now}
            startOfTodayNZ={startOfTodayNZ}
          />

          {/* Mobile List View */}
          <MobileListView
            calendarDays={calendarDays}
            shiftsByDate={shiftsByDate}
            availableShiftsByDate={availableShiftsByDate}
            viewMonth={viewMonth}
            now={now}
            startOfTodayNZ={startOfTodayNZ}
          />
        </CardContent>
      </Card>
    </>
  );
}

// --- Desktop Calendar Grid ---

function DesktopCalendarGrid({
  calendarDays,
  shiftsByDate,
  availableShiftsByDate,
  viewMonth,
  now,
  startOfTodayNZ,
}: {
  calendarDays: Date[];
  shiftsByDate: Map<string, ShiftSignup[]>;
  availableShiftsByDate: Map<string, unknown[]>;
  viewMonth: Date;
  now: Date;
  startOfTodayNZ: Date;
}) {
  return (
    <div
      className="hidden sm:grid grid-cols-7 gap-3"
      data-testid="calendar-grid"
    >
      {/* Day headers */}
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
        <div
          key={day}
          className={`py-3 px-2 text-center text-sm font-semibold tracking-wide ${
            index === 0 || index === 6
              ? "text-muted-foreground"
              : "text-foreground"
          }`}
        >
          {day}
        </div>
      ))}

      {/* Calendar days */}
      {calendarDays.map((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const dayShifts = shiftsByDate.get(dateKey) || [];
        const dayAvailable = (availableShiftsByDate.get(dateKey) || []) as unknown[];
        const isCurrentMonth = isSameMonth(day, viewMonth);
        const isToday = isSameDayInNZT(day, now);
        const isPast = day < startOfTodayNZ;
        const shift = dayShifts[0];
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;

        return (
          <div
            key={dateKey}
            className={`
              min-h-[140px] p-3 rounded-xl relative flex flex-col
              transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-lg
              ${
                !isCurrentMonth
                  ? "bg-gray-50/50 dark:bg-gray-900/30 border border-gray-200/40 dark:border-gray-700/40 opacity-50"
                  : isPast
                  ? "bg-gray-50/70 dark:bg-gray-900/30 border border-gray-200/60 dark:border-gray-700/60 shadow-sm"
                  : isToday
                  ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-300 dark:border-blue-700 shadow-md ring-2 ring-blue-200/40 dark:ring-blue-800/40"
                  : isWeekend
                  ? "bg-gray-50/50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md"
                  : "bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md"
              }
            `}
          >
            {/* Date number */}
            <div className="flex items-center justify-between mb-2">
              <div
                data-testid="calendar-day-number"
                className={`
                  text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center
                  ${
                    !isCurrentMonth
                      ? "text-gray-400 dark:text-gray-600"
                      : isPast
                      ? "text-gray-400 dark:text-gray-600"
                      : isToday
                      ? "text-white bg-blue-500 shadow-md"
                      : "text-gray-700 dark:text-gray-300"
                  }
                `}
              >
                {format(day, "d")}
              </div>
              {isToday && (
                <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                  Today
                </div>
              )}
            </div>

            {/* Shift content */}
            <div className="flex-1 flex flex-col justify-center">
              {shift ? (
                <ShiftDetailsDialog shift={shift} now={now}>
                  <div className="w-full group cursor-pointer">
                    {(() => {
                      const theme = getShiftTheme(shift.shift.shiftType.name);
                      return (
                        <div
                          className={`
                            relative p-3 rounded-lg text-white shadow-md
                            transition-all duration-200 ease-in-out
                            group-hover:shadow-lg group-hover:scale-105
                            ${
                              isPast
                                ? `bg-gradient-to-br ${theme.fullGradient} opacity-50`
                                : `bg-gradient-to-br ${theme.fullGradient} hover:shadow-xl`
                            }
                          `}
                        >
                          <div className="text-center space-y-1">
                            <div className="text-xl">{theme.emoji}</div>
                            <div className="font-bold text-sm">
                              {formatInNZT(shift.shift.start, "HH:mm")}
                            </div>
                            <div className="text-xs opacity-90 font-medium line-clamp-2">
                              {shift.shift.shiftType.name}
                            </div>
                            {shift.shift.signups.length > 0 && (
                              <div className="flex justify-center mt-1">
                                <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
                                  <UserCheck className="h-3 w-3" />
                                  <span className="text-xs font-medium">
                                    +{shift.shift.signups.length}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg pointer-events-none" />
                        </div>
                      );
                    })()}
                  </div>
                </ShiftDetailsDialog>
              ) : (
                <div className="text-center">
                  {isPast ? (
                    <div className="text-gray-400 dark:text-gray-600 text-xs font-medium">
                      No shifts
                    </div>
                  ) : dayAvailable.length > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-7 px-3 text-xs font-medium border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200"
                    >
                      <Link
                        href={`/shifts?date=${dateKey}`}
                        className="flex items-center gap-1"
                      >
                        <CalendarPlus className="h-3 w-3" />
                        {dayAvailable.length} available
                      </Link>
                    </Button>
                  ) : (
                    <div className="text-gray-400 dark:text-gray-600 text-xs font-medium">
                      No shifts
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Mobile List View ---

function MobileListView({
  calendarDays,
  shiftsByDate,
  availableShiftsByDate,
  viewMonth,
  now,
  startOfTodayNZ,
}: {
  calendarDays: Date[];
  shiftsByDate: Map<string, ShiftSignup[]>;
  availableShiftsByDate: Map<string, unknown[]>;
  viewMonth: Date;
  now: Date;
  startOfTodayNZ: Date;
}) {
  return (
    <div className="sm:hidden space-y-3" data-testid="mobile-list-view">
      {calendarDays.map((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const dayShifts = shiftsByDate.get(dateKey) || [];
        const dayAvailable = (availableShiftsByDate.get(dateKey) || []) as unknown[];
        const isCurrentMonth = isSameMonth(day, viewMonth);
        const isToday = isSameDayInNZT(day, now);
        const isPast = day < startOfTodayNZ;
        const shift = dayShifts[0];

        if (
          (!shift && dayAvailable.length === 0 && !isToday) ||
          !isCurrentMonth
        ) {
          return null;
        }

        return (
          <div
            key={dateKey}
            className={`
              p-4 rounded-xl border transition-all duration-200
              ${
                isPast
                  ? "bg-gray-50/70 dark:bg-gray-900/30 border-gray-200/60 dark:border-gray-700/60"
                  : isToday
                  ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-300 dark:border-blue-700 shadow-md ring-1 ring-blue-200/40 dark:ring-blue-800/40"
                  : "bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:shadow-md"
              }
            `}
          >
            {/* Date Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  data-testid="calendar-day-number"
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold
                    ${
                      isPast
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
                        : isToday
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }
                  `}
                >
                  {format(day, "d")}
                </div>
                <div>
                  <div className="font-semibold text-sm">
                    {format(day, "EEEE")}
                    {isToday && (
                      <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(day, "MMMM d, yyyy")}
                  </div>
                </div>
              </div>
            </div>

            {/* Shift Content */}
            {shift ? (
              <ShiftDetailsDialog shift={shift} now={now}>
                <div className="cursor-pointer">
                  {(() => {
                    const theme = getShiftTheme(shift.shift.shiftType.name);
                    return (
                      <div
                        className={`
                          relative p-4 rounded-lg text-white shadow-md
                          transition-all duration-200 ease-in-out hover:shadow-lg
                          ${
                            isPast
                              ? `bg-gradient-to-br ${theme.fullGradient} opacity-50`
                              : `bg-gradient-to-br ${theme.fullGradient} hover:shadow-xl`
                          }
                        `}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center gap-4">
                            <div className="text-3xl">{theme.emoji}</div>
                            <div className="flex-1">
                              <div className="font-bold text-lg">
                                {shift.shift.shiftType.name}
                              </div>
                              <div className="text-sm opacity-90 flex items-center gap-2 mt-1">
                                <Timer className="h-4 w-4" />
                                {formatInNZT(shift.shift.start, "h:mm a")} -{" "}
                                {formatInNZT(shift.shift.end, "h:mm a")}
                              </div>
                              {shift.shift.location && (
                                <div className="text-sm opacity-75 mt-1">
                                  📍 {shift.shift.location}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <StatusBadge
                                status={shift.status}
                                isPast={isPast}
                              />
                            </div>
                            {shift.shift.signups.length > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-1">
                                  <UserCheck className="h-3 w-3" />
                                  <span className="text-xs font-medium">
                                    {shift.shift.signups.length} friend
                                    {shift.shift.signups.length !== 1
                                      ? "s"
                                      : ""}{" "}
                                    joining
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-lg pointer-events-none" />
                      </div>
                    );
                  })()}
                </div>
              </ShiftDetailsDialog>
            ) : dayAvailable.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  {dayAvailable.length} shift
                  {dayAvailable.length !== 1 ? "s" : ""} available
                </div>
                <Button
                  asChild
                  className="w-full justify-start gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                >
                  <Link href={`/shifts?date=${dateKey}`}>
                    <CalendarPlus className="h-4 w-4" />
                    Browse Available Shifts
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <div className="text-2xl mb-2">📅</div>
                <div className="text-sm font-medium">
                  No shifts scheduled
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Show message if no shifts in the month */}
      {calendarDays.every((day) => {
        const dateKey = format(day, "yyyy-MM-dd");
        const dayShifts = shiftsByDate.get(dateKey) || [];
        const dayAvailable = availableShiftsByDate.get(dateKey) || [];
        const isToday = isSameDayInNZT(day, now);
        return dayShifts.length === 0 && dayAvailable.length === 0 && !isToday;
      }) && (
        <div className="text-center py-8 text-muted-foreground">
          <div className="text-4xl mb-3">📅</div>
          <div className="text-lg font-medium mb-2">
            No shifts in {format(viewMonth, "MMMM yyyy")}
          </div>
          <div className="text-sm mb-4">
            Check out other months or browse available shifts
          </div>
          <Button asChild className="gap-2">
            <Link href="/shifts">
              <CalendarPlus className="h-4 w-4" />
              Browse Shifts
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

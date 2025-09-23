import { prisma } from "@/lib/prisma";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  differenceInHours,
  startOfWeek,
  endOfWeek,
  isSameMonth,
} from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { safeParseAvailability } from "@/lib/parse-availability";
import { generateCalendarUrls } from "@/lib/calendar-utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedStatsGrid } from "@/components/animated-stats-grid";
import { Button } from "@/components/ui/button";
import { AvatarList } from "@/components/ui/avatar-list";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { CancelSignupButton } from "./cancel-signup-button";
import { PageHeader } from "@/components/page-header";
import {
  Calendar,
  Timer,
  CheckCircle,
  Users,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
} from "lucide-react";
import { PageContainer } from "@/components/page-container";

// Shift type theming configuration
const SHIFT_THEMES = {
  Dishwasher: {
    gradient: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-200 dark:border-blue-800/50",
    textColor: "text-blue-700 dark:text-blue-300",
    emoji: "🧽",
  },
  "FOH Set-Up & Service": {
    gradient: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    borderColor: "border-purple-200 dark:border-purple-800/50",
    textColor: "text-purple-700 dark:text-purple-300",
    emoji: "✨",
  },
  "Front of House": {
    gradient: "from-green-500 to-emerald-500",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    borderColor: "border-green-200 dark:border-green-800/50",
    textColor: "text-green-700 dark:text-green-300",
    emoji: "🌟",
  },
  "Kitchen Prep": {
    gradient: "from-orange-500 to-amber-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
    borderColor: "border-orange-200 dark:border-orange-800/50",
    textColor: "text-orange-700 dark:text-orange-300",
    emoji: "🔪",
  },
  "Kitchen Prep & Service": {
    gradient: "from-red-500 to-pink-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    borderColor: "border-red-200 dark:border-red-800/50",
    textColor: "text-red-700 dark:text-red-300",
    emoji: "🍳",
  },
  "Kitchen Service & Pack Down": {
    gradient: "from-indigo-500 to-purple-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
    borderColor: "border-indigo-200 dark:border-indigo-800/50",
    textColor: "text-indigo-700 dark:text-indigo-300",
    emoji: "📦",
  },
} as const;

const DEFAULT_THEME = {
  gradient: "from-gray-500 to-slate-500",
  bgColor: "bg-gray-50 dark:bg-gray-950/20",
  borderColor: "border-gray-200 dark:border-gray-800/50",
  textColor: "text-gray-700 dark:text-gray-300",
  emoji: "❤️",
};

function getShiftTheme(shiftTypeName: string) {
  return (
    SHIFT_THEMES[shiftTypeName as keyof typeof SHIFT_THEMES] || DEFAULT_THEME
  );
}


export default async function MyShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login?callbackUrl=/shifts/mine");
  }

  const params = await searchParams;
  const now = new Date();

  // Parse month/year for calendar navigation
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const viewMonth = params.month
    ? new Date(parseInt(params.month as string))
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

  // Fetch all user's shifts for stats and calendar
  const [allShifts, monthShifts, totalStats, availableShifts] =
    await Promise.all([
      // All shifts for overall stats
      prisma.signup.findMany({
        where: {
          userId: userId!,
          status: { not: "CANCELED" },
        },
        select: {
          id: true,
          userId: true,
          shiftId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          isFlexiblePlacement: true,
          originalShiftId: true,
          placedAt: true,
          placementNotes: true,
          shift: {
            include: {
              shiftType: true,
              signups: {
                where:
                  userFriendIds.length > 0
                    ? {
                        userId: { in: userFriendIds },
                        status: { in: ["CONFIRMED", "PENDING"] },
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
      // Shifts for the current view month
      prisma.signup.findMany({
        where: {
          userId: userId!,
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
          isFlexiblePlacement: true,
          originalShiftId: true,
          placedAt: true,
          placementNotes: true,
          shift: {
            include: {
              shiftType: true,
              signups: {
                where:
                  userFriendIds.length > 0
                    ? {
                        userId: { in: userFriendIds },
                        status: { in: ["CONFIRMED", "PENDING"] },
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
      }),
      // Count stats
      Promise.all([
        prisma.signup.count({
          where: {
            userId: userId!,
            shift: { end: { lt: now } },
            status: "CONFIRMED",
          },
        }),
        prisma.signup.count({
          where: {
            userId: userId!,
            shift: { start: { gte: now } },
            status: { in: ["CONFIRMED", "PENDING"] },
          },
        }),
      ]),
      // Available shifts in user's preferred locations for the month
      userPreferredLocations.length > 0
        ? prisma.shift.findMany({
            where: {
              start: { gte: monthStart, lte: monthEnd },
              location: { in: userPreferredLocations },
              // Only shifts that aren't full and user hasn't signed up for
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
                  status: { in: ["CONFIRMED", "PENDING"] },
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
    const dateKey = format(shift.shift.start, "yyyy-MM-dd");
    if (!shiftsByDate.has(dateKey)) {
      shiftsByDate.set(dateKey, []);
    }
    shiftsByDate.get(dateKey)!.push(shift);
  }

  // Group available shifts by date (for showing browse links)
  type AvailableShift = typeof availableShifts extends readonly (infer T)[]
    ? T
    : never;
  const availableShiftsByDate = new Map<string, AvailableShift[]>();
  for (const shift of availableShifts) {
    const dateKey = format(shift.start, "yyyy-MM-dd");
    if (!availableShiftsByDate.has(dateKey)) {
      availableShiftsByDate.set(dateKey, []);
    }
    // Only include if shift has available spots
    const confirmedSignups = shift.signups.filter(
      (s) => s.status === "CONFIRMED"
    ).length;
    const pendingSignups = shift.signups.filter(
      (s) => s.status === "PENDING"
    ).length;
    const hasAvailableSpots =
      confirmedSignups + pendingSignups < shift.capacity;

    if (hasAvailableSpots) {
      availableShiftsByDate.get(dateKey)!.push(shift);
    }
  }

  function ShiftDetailsDialog({
    shift,
    children,
  }: {
    shift: (typeof monthShifts)[0];
    children: React.ReactNode;
  }) {
    const theme = getShiftTheme(shift.shift.shiftType.name);
    const isPastShift = shift.shift.end < now;

    return (
      <ResponsiveDialog>
        <ResponsiveDialogTrigger asChild>{children}</ResponsiveDialogTrigger>
        <ResponsiveDialogContent className="max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl bg-gradient-to-br ${theme.gradient} shadow-lg flex items-center justify-center text-white text-lg`}
              >
                {theme.emoji}
              </div>
              <div>
                <div className="font-semibold">
                  {shift.shift.shiftType.name}
                </div>
                <div className="text-sm font-normal text-muted-foreground">
                  {format(shift.shift.start, "EEEE, MMMM d, yyyy")}
                </div>
              </div>
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>

          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <StatusBadge status={shift.status} isPast={isPastShift} />
            </div>

            {/* Flexible Placement Indicator */}
            {shift.isFlexiblePlacement && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Placement Type</span>
                <span className="text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-md">
                  Flexible placement
                </span>
              </div>
            )}

            {/* Time */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Time</span>
              <div className="text-sm text-right">
                <div>
                  {format(shift.shift.start, "h:mm a")} -{" "}
                  {format(shift.shift.end, "h:mm a")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {differenceInHours(shift.shift.end, shift.shift.start)} hours
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Location</span>
              <span className="text-sm">
                {shift.shift.location || "To be confirmed"}
              </span>
            </div>

            {/* Description */}
            {shift.shift.shiftType.description && (
              <div>
                <div className="text-sm font-medium mb-2">Description</div>
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  {shift.shift.shiftType.description}
                </div>
              </div>
            )}

            {/* Notes */}
            {shift.shift.notes && (
              <div>
                <div className="text-sm font-medium mb-2">Notes</div>
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  {shift.shift.notes}
                </div>
              </div>
            )}

            {/* Friends joining */}
            {shift.shift.signups.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-3">Friends Joining</div>
                <AvatarList
                  users={shift.shift.signups.map((signup) => signup.user)}
                  size="md"
                  maxDisplay={6}
                />
              </div>
            )}

            {/* Actions */}
            {!isPastShift && (
              <div className="pt-4 border-t space-y-3">
                {/* Add to Calendar */}
                <div>
                  <div className="text-sm font-medium mb-2">
                    Add to Calendar
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(() => {
                      const urls = generateCalendarUrls(shift.shift);
                      return (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            asChild
                          >
                            <a
                              href={urls.google}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <CalendarPlus className="h-3 w-3" />
                              Google
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            asChild
                          >
                            <a
                              href={urls.outlook}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <CalendarPlus className="h-3 w-3" />
                              Outlook
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            asChild
                          >
                            <a
                              href={urls.ics}
                              download={`shift-${shift.shift.id}.ics`}
                            >
                              <CalendarPlus className="h-3 w-3" />
                              .ics File
                            </a>
                          </Button>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Cancel Shift */}
                <CancelSignupButton
                  shiftId={shift.shift.id}
                  shiftName={shift.shift.shiftType.name}
                />
              </div>
            )}
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  function StatusBadge({
    status,
    isPast = false,
  }: {
    status: string;
    isPast?: boolean;
  }) {
    switch (status) {
      case "PENDING":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50"
          >
            <Timer className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/50">
            <CheckCircle className="h-3 w-3 mr-1" />
            {isPast ? "Completed" : "Confirmed"}
          </Badge>
        );
      case "WAITLISTED":
        return (
          <Badge variant="secondary">
            <Users className="h-3 w-3 mr-1" />
            Waitlisted
          </Badge>
        );
      default:
        return null;
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
    <PageContainer testid="my-shifts-page">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <PageHeader
          title="My Shifts"
          description="Your volunteer schedule and shift history."
          className="flex-1"
        />
      </div>

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
            title: "This Month",
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

      {/* Schedule View - Calendar on desktop, List on mobile */}
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
                    query: {
                      month: prevMonth.getTime().toString(),
                    },
                  }}
                  className="flex items-center justify-center"
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Previous
                </Link>
              </Button>

              {/* Current Month Button - only show if not already viewing current month */}
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
                    query: {
                      month: nextMonth.getTime().toString(),
                    },
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
                    query: {
                      month: prevMonth.getTime().toString(),
                    },
                  }}
                  className="flex items-center"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="ml-1">Prev</span>
                </Link>
              </Button>

              {/* Current Month Button - only show if not already viewing current month */}
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
                    query: {
                      month: nextMonth.getTime().toString(),
                    },
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
          <div
            className="hidden sm:grid grid-cols-7 gap-3"
            data-testid="calendar-grid"
          >
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (day, index) => (
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
              )
            )}

            {/* Calendar days */}
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayShifts = shiftsByDate.get(dateKey) || [];
              const availableShifts = availableShiftsByDate.get(dateKey) || [];
              const isCurrentMonth = isSameMonth(day, viewMonth);
              const isToday = isSameDay(day, now);
              const isPast = day < now && !isToday;
              const shift = dayShifts[0]; // Since only 1 shift per day is allowed
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
                      <ShiftDetailsDialog shift={shift}>
                        <div className="w-full group cursor-pointer">
                          {(() => {
                            const theme = getShiftTheme(
                              shift.shift.shiftType.name
                            );
                            return (
                              <div
                                className={`
                                  relative p-3 rounded-lg text-white shadow-md 
                                  transition-all duration-200 ease-in-out
                                  group-hover:shadow-lg group-hover:scale-105
                                  ${
                                    isPast
                                      ? `bg-gradient-to-br ${theme.gradient} opacity-50`
                                      : `bg-gradient-to-br ${theme.gradient} hover:shadow-xl`
                                  }
                                `}
                              >
                                <div className="text-center space-y-1">
                                  <div className="text-xl">{theme.emoji}</div>
                                  <div className="font-bold text-sm">
                                    {format(shift.shift.start, "HH:mm")}
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

                                {/* Subtle gradient overlay for better readability */}
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
                        ) : availableShifts.length > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-7 px-3 text-xs font-medium border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200"
                          >
                            <Link
                              href="/shifts"
                              className="flex items-center gap-1"
                            >
                              <CalendarPlus className="h-3 w-3" />
                              {availableShifts.length} available
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

          {/* Mobile List View */}
          <div className="sm:hidden space-y-3" data-testid="mobile-list-view">
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayShifts = shiftsByDate.get(dateKey) || [];
              const availableShifts = availableShiftsByDate.get(dateKey) || [];
              const isCurrentMonth = isSameMonth(day, viewMonth);
              const isToday = isSameDay(day, now);
              const isPast = day < now && !isToday;
              const shift = dayShifts[0];

              // Skip days without shifts or available shifts unless it's today, and skip non-current month days
              if ((!shift && availableShifts.length === 0 && !isToday) || !isCurrentMonth) {
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
                    <ShiftDetailsDialog shift={shift}>
                      <div className="cursor-pointer">
                        {(() => {
                          const theme = getShiftTheme(
                            shift.shift.shiftType.name
                          );
                          return (
                            <div
                              className={`
                                      relative p-4 rounded-lg text-white shadow-md 
                                      transition-all duration-200 ease-in-out hover:shadow-lg
                                      ${
                                        isPast
                                          ? `bg-gradient-to-br ${theme.gradient} opacity-50`
                                          : `bg-gradient-to-br ${theme.gradient} hover:shadow-xl`
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
                                      {format(
                                        shift.shift.start,
                                        "h:mm a"
                                      )} - {format(shift.shift.end, "h:mm a")}
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
                              {/* Subtle gradient overlay for better readability */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-lg pointer-events-none" />
                            </div>
                          );
                        })()}
                      </div>
                    </ShiftDetailsDialog>
                  ) : availableShifts.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">
                        {availableShifts.length} shift
                        {availableShifts.length !== 1 ? "s" : ""} available
                      </div>
                      <Button
                        asChild
                        className="w-full justify-start gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                      >
                        <Link href="/shifts">
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
              const availableShifts = availableShiftsByDate.get(dateKey) || [];
              const isToday = isSameDay(day, now);
              return (
                dayShifts.length === 0 &&
                availableShifts.length === 0 &&
                !isToday
              );
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
        </CardContent>
      </Card>
    </PageContainer>
  );
}

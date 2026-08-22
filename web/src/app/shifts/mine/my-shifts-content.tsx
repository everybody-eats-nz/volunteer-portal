import { prisma } from "@/lib/prisma";
import { format, startOfMonth, endOfMonth, differenceInHours } from "date-fns";
import { formatInNZT, isSameDayInNZT } from "@/lib/timezone";
import { safeParseAvailability } from "@/lib/parse-availability";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatBand } from "@/components/ui/stat-band";
import { AvatarList } from "@/components/ui/avatar-list";
import { ShiftDetailsDialog } from "./shift-details-dialog";
import { StatusBadge } from "./status-badge";
import { getShiftTheme } from "@/lib/shift-themes";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";

// Export the shift signup type for use by ShiftDetailsDialog
export type ShiftSignup = Awaited<ReturnType<typeof fetchMonthShifts>>[number];

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

/* Pill links — shared brand system with the marketing site
   (marketing-cms STYLEGUIDE.md: btn-primary / btn-ghost). */
const pill =
  "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-all duration-200";
const pillPrimary = `${pill} bg-forest-500 text-cream-50 hover:bg-forest-600 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0`;
const pillGhost = `${pill} border border-forest-500/30 text-forest-700 hover:bg-forest-700 hover:text-cream-50 hover:border-forest-700 dark:border-cream-50/30 dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700`;

const eyebrowLight =
  "eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60";
const eyebrowRule =
  "inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40";

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

  // Parse month/year for schedule navigation
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const viewMonth = monthParam ? new Date(parseInt(monthParam)) : currentMonth;

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
          status: true,
          shift: {
            select: { start: true, end: true },
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

  const totalHours = Math.round(
    allShifts
      .filter((s) => s.shift.end < now && s.status === "CONFIRMED")
      .reduce(
        (total, s) => total + differenceInHours(s.shift.end, s.shift.start),
        0
      )
  );

  // Split the month's shifts into upcoming and past
  const sortedMonthShifts = [...monthShifts].sort(
    (a, b) => a.shift.start.getTime() - b.shift.start.getTime()
  );
  const upcoming = sortedMonthShifts.filter((s) => s.shift.end >= now);
  const past = sortedMonthShifts
    .filter((s) => s.shift.end < now)
    .reverse(); // most recent first

  // Group open shifts (spots available, preferred locations) by day for the
  // "more mahi" strip — one chip per day, deep-linking to that day's page.
  const openDays = new Map<
    string,
    { date: Date; count: number; locations: Set<string> }
  >();
  for (const shift of availableShifts) {
    const confirmedSignups = shift.signups.filter(
      (s) => s.status === "CONFIRMED"
    ).length;
    const pendingSignups = shift.signups.filter(
      (s) => s.status === "PENDING" || s.status === "REGULAR_PENDING"
    ).length;
    if (confirmedSignups + pendingSignups >= shift.capacity) continue;

    const dateKey = formatInNZT(shift.start, "yyyy-MM-dd");
    const existing = openDays.get(dateKey);
    if (existing) {
      existing.count++;
      if (shift.location) existing.locations.add(shift.location);
    } else {
      openDays.set(dateKey, {
        date: shift.start,
        count: 1,
        locations: new Set(shift.location ? [shift.location] : []),
      });
    }
  }
  const openDayChips = Array.from(openDays.entries())
    .map(([dateKey, { date, count, locations }]) => ({
      dateKey,
      date,
      count,
      // When every open shift that day is at one location, link straight to
      // that location's day view; otherwise the day view shows all locations.
      href:
        locations.size === 1
          ? `/shifts/details?date=${dateKey}&location=${encodeURIComponent(
              [...locations][0]
            )}`
          : `/shifts/details?date=${dateKey}`,
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

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
  const isViewingCurrentMonth =
    viewMonth.getMonth() === currentMonth.getMonth() &&
    viewMonth.getFullYear() === currentMonth.getFullYear();
  const isPastMonth = monthEnd < now;

  const stats = [
    {
      label: "Shifts completed",
      value: completedShifts,
      testId: "completed-shifts-card",
    },
    {
      label: "Coming up",
      value: upcomingShifts,
      testId: "upcoming-shifts-card",
    },
    {
      label: "This month",
      value: monthShifts.length,
      testId: "this-month-shifts-card",
    },
    {
      label: "Hours of mahi",
      value: totalHours,
      testId: "total-hours-card",
    },
  ];

  return (
    <>
      {/* Stats overview — editorial hairline band, matching the landing
          page's "mahi in numbers" treatment. */}
      <StatBand testId="stats-overview" className="mb-8" stats={stats} />

      {/* Schedule panel */}
      <section
        data-testid="schedule-panel"
        className="grain relative overflow-hidden rounded-[2rem] border border-forest-500/10 bg-card p-5 sm:p-8 dark:border-cream-50/10"
      >
        {/* Month header + navigation */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p data-testid="month-description" className={`${eyebrowLight} mb-3`}>
              <span className={eyebrowRule} />
              Your volunteer schedule
            </p>
            <h2
              data-testid="month-title"
              className="display text-3xl tracking-tight text-forest-700 sm:text-4xl dark:text-cream-50"
            >
              {format(viewMonth, "MMMM")} <em>{format(viewMonth, "yyyy")}</em>
            </h2>
          </div>
          <div
            className="flex items-center gap-2"
            data-testid="month-navigation"
          >
            <Button
              variant="outline"
              size="sm"
              asChild
              data-testid="prev-month-button"
            >
              <Link
                href={{
                  pathname: "/shifts/mine",
                  query: { month: prevMonth.getTime().toString() },
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Prev</span>
              </Link>
            </Button>

            {!isViewingCurrentMonth && (
              <Button
                variant="outline"
                size="sm"
                asChild
                data-testid="today-button"
                className="border-sun-300/70 bg-sun-100 text-forest-700 hover:bg-sun-200 dark:border-sun-200/30 dark:bg-sun-200/15 dark:text-sun-100 dark:hover:bg-sun-200/25"
              >
                <Link href="/shifts/mine">Today</Link>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              asChild
              data-testid="next-month-button"
            >
              <Link
                href={{
                  pathname: "/shifts/mine",
                  query: { month: nextMonth.getTime().toString() },
                }}
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {monthShifts.length === 0 ? (
          <EmptyMonth viewMonth={viewMonth} isPastMonth={isPastMonth} />
        ) : (
          <div data-testid="shift-list" className="space-y-8">
            {/* Upcoming shifts */}
            {!isPastMonth && (
              <div className="space-y-3" data-testid="upcoming-section">
                <p className={eyebrowLight}>
                  <span className={eyebrowRule} />
                  Coming up
                  {upcoming.length > 0 && (
                    <span className="text-forest-500/60 dark:text-cream-50/45">
                      · {upcoming.length}
                    </span>
                  )}
                </p>
                {upcoming.length > 0 ? (
                  upcoming.map((shift) => (
                    <ShiftRow
                      key={shift.id}
                      shift={shift}
                      now={now}
                      isPast={false}
                    />
                  ))
                ) : (
                  <div
                    data-testid="no-upcoming"
                    className="rounded-2xl border border-dashed border-forest-500/20 px-6 py-8 text-center dark:border-cream-50/20"
                  >
                    <p className="text-sm leading-relaxed text-forest-700/70 dark:text-cream-50/70">
                      Nothing else booked this month — there&apos;s always room
                      for more helping hands.
                    </p>
                    <Link href="/shifts" className={`${pillGhost} mt-4`}>
                      Browse shifts
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Past shifts */}
            {past.length > 0 && (
              <div className="space-y-3" data-testid="past-section">
                <p className={eyebrowLight}>
                  <span className={eyebrowRule} />
                  {isPastMonth ? "Completed shifts" : "Earlier this month"}
                  <span className="text-forest-500/60 dark:text-cream-50/45">
                    · {past.length}
                  </span>
                </p>
                {past.map((shift) => (
                  <ShiftRow
                    key={shift.id}
                    shift={shift}
                    now={now}
                    isPast={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Open days — more mahi available this month */}
        {openDayChips.length > 0 && (
          <div
            data-testid="open-days"
            className="grain relative mt-8 overflow-hidden rounded-2xl bg-sun-100/70 p-5 ring-1 ring-forest-500/10 sm:p-6 dark:bg-sun-200/10 dark:ring-cream-50/10"
          >
            <p className="eyebrow flex items-center gap-3 text-forest-600/80 dark:text-sun-200/80">
              <span className="inline-block h-px w-8 bg-forest-500/40 dark:bg-sun-200/40" />
              More mahi this month
            </p>
            <p className="mt-2 text-sm leading-relaxed text-forest-700/80 dark:text-cream-50/75">
              There&apos;s still room on{" "}
              {openDayChips.length === 1
                ? "one day"
                : `${openDayChips.length} days`}{" "}
              at your preferred locations — the whānau would love a hand.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {openDayChips.map((day) => (
                <Link
                  key={day.dateKey}
                  href={day.href}
                  data-testid="open-day-chip"
                  className="inline-flex items-center gap-1.5 rounded-full border border-forest-500/15 bg-background px-3.5 py-1.5 text-xs font-medium text-forest-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-forest-500/40 hover:shadow-md dark:border-cream-50/15 dark:text-cream-50"
                >
                  <CalendarPlus className="h-3 w-3" />
                  {formatInNZT(day.date, "EEE d")} · {day.count} available
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}

// --- Shift row ---

function ShiftRow({
  shift,
  now,
  isPast,
}: {
  shift: ShiftSignup;
  now: Date;
  isPast: boolean;
}) {
  const theme = getShiftTheme(shift.shift.shiftType.name);
  const isToday = isSameDayInNZT(shift.shift.start, now);
  const friendCount = shift.shift.signups.length;

  return (
    <ShiftDetailsDialog shift={shift} now={now}>
      <button
        type="button"
        data-testid="shift-row"
        className={`group block w-full rounded-2xl border p-4 text-left transition-all duration-200 sm:p-5 ${
          isPast
            ? "border-forest-500/10 bg-cream-100/60 opacity-75 hover:opacity-100 dark:border-cream-50/10 dark:bg-forest-800/40"
            : "border-forest-500/10 bg-background shadow-sm hover:-translate-y-0.5 hover:shadow-lg dark:border-cream-50/10"
        }`}
      >
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Date block */}
          <div
            className="w-11 shrink-0 text-center sm:w-12"
            data-testid="shift-row-date"
          >
            <div className="eyebrow text-forest-500/70 dark:text-cream-50/55">
              {formatInNZT(shift.shift.start, "EEE")}
            </div>
            <div className="display mt-0.5 text-2xl leading-none text-forest-700 tabular-nums sm:text-3xl dark:text-cream-50">
              {formatInNZT(shift.shift.start, "d")}
            </div>
          </div>

          <div className="h-12 w-px shrink-0 bg-forest-500/10 dark:bg-cream-50/15" />

          {/* Shift info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="display display-medium text-lg leading-tight tracking-tight text-forest-700 sm:text-xl dark:text-cream-50">
                {shift.shift.shiftType.name}
              </span>
              <span aria-hidden className="text-sm">
                {theme.emoji}
              </span>
              {isToday && !isPast && (
                <span
                  data-testid="today-pill"
                  className="rounded-full bg-sun-200 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-forest-700"
                >
                  Today
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-forest-700/70 dark:text-cream-50/65">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {formatInNZT(shift.shift.start, "h:mm a")} –{" "}
                {formatInNZT(shift.shift.end, "h:mm a")}
              </span>
              {shift.shift.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {shift.shift.location}
                </span>
              )}
              {friendCount > 0 && (
                <span
                  data-testid="friend-chip"
                  className="inline-flex items-center gap-2"
                >
                  {/* Links stay off — the whole row is already a button */}
                  <AvatarList
                    users={shift.shift.signups.map((signup) => signup.user)}
                    size="sm"
                    maxDisplay={3}
                    enableLinks={false}
                  />
                  <span className="text-xs font-medium text-forest-700/70 dark:text-cream-50/65">
                    {isPast ? "joined" : "joining"}
                  </span>
                </span>
              )}
              {/* On narrow screens the status joins the meta line so the
                  title keeps room to breathe */}
              <span className="sm:hidden">
                <StatusBadge status={shift.status} isPast={isPast} />
              </span>
            </div>
          </div>

          {/* Status + affordance */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden sm:block">
              <StatusBadge status={shift.status} isPast={isPast} />
            </span>
            <ChevronRight
              className="h-4 w-4 text-forest-500/40 transition-transform group-hover:translate-x-0.5 dark:text-cream-50/40"
              aria-hidden
            />
          </div>
        </div>
      </button>
    </ShiftDetailsDialog>
  );
}

// --- Empty month state ---

function EmptyMonth({
  viewMonth,
  isPastMonth,
}: {
  viewMonth: Date;
  isPastMonth: boolean;
}) {
  return (
    <div data-testid="empty-month" className="px-4 py-12 text-center sm:py-16">
      <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-500/10 dark:bg-cream-50/10">
        <CalendarPlus
          className="h-8 w-8 text-forest-500 dark:text-cream-50/70"
          aria-hidden
        />
        <Sparkle className="absolute -right-2 -top-2 h-5 w-5 text-sun-300" />
      </div>
      <h3 className="display text-2xl tracking-tight text-forest-700 sm:text-3xl dark:text-cream-50">
        No mahi booked for <em>{format(viewMonth, "MMMM")}</em>
      </h3>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-forest-700/70 dark:text-cream-50/70">
        {isPastMonth
          ? "You didn't have any shifts this month. Browse what's coming up and join us for the next service."
          : "Your plate is clear — find a shift that suits and join the whānau in the kitchen."}
      </p>
      <Link
        href="/shifts"
        data-testid="browse-shifts-button"
        className={`${pillPrimary} mt-8`}
      >
        Browse shifts
      </Link>
    </div>
  );
}

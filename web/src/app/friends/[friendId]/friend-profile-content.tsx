import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { differenceInDays, differenceInHours, subMonths } from "date-fns";
import { formatInNZT } from "@/lib/timezone";
import {
  isAMShift,
  getShiftDate,
  getShiftPeriodLabel,
} from "@/lib/concurrent-shifts";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StatBand } from "@/components/ui/stat-band";
import { Calendar, MapPin } from "lucide-react";
import { MotionFriendStats } from "@/components/motion-friends";

interface FriendProfileContentProps {
  friendId: string;
}

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

const eyebrowLight =
  "eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60";
const eyebrowRule =
  "inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40";

/* Pill links — shared brand system with the marketing site. */
const pillGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-forest-500/30 px-6 py-3 text-sm font-medium text-forest-700 transition-all duration-200 hover:border-forest-700 hover:bg-forest-700 hover:text-cream-50 dark:border-cream-50/30 dark:text-cream-50 dark:hover:border-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700";
const pillPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-forest-500 px-7 py-3.5 text-sm font-medium text-cream-50 transition-all duration-200 hover:-translate-y-0.5 hover:bg-forest-600 hover:shadow-lg active:translate-y-0";

export async function FriendProfileContent({
  friendId,
}: FriendProfileContentProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/friends");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, firstName: true, lastName: true },
  });

  if (!user) {
    redirect("/login?callbackUrl=/friends");
  }

  // Get the friend and verify friendship exists
  const [friend, friendship] = await Promise.all([
    prisma.user.findUnique({
      where: { id: friendId },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePhotoUrl: true,
        friendVisibility: true,
      },
    }),
    prisma.friendship.findFirst({
      where: {
        AND: [
          {
            OR: [
              { userId: user.id, friendId: friendId },
              { userId: friendId, friendId: user.id },
            ],
          },
          { status: "ACCEPTED" },
        ],
      },
      select: {
        createdAt: true,
        userId: true,
        friendId: true,
      },
    }),
  ]);

  if (!friend || !friendship) {
    notFound();
  }

  // Check friend visibility
  if (friend.friendVisibility === "PRIVATE") {
    notFound();
  }

  // Get comprehensive friendship stats
  const [
    userShifts,
    friendShifts,
    friendUpcomingShifts,
    friendCompletedShifts,
    friendTotalShifts,
    friendThisMonthShifts,
    friendLast6MonthsShifts,
  ] = await Promise.all([
    // Get all user's shifts (confirmed or pending)
    prisma.signup.findMany({
      where: {
        userId: user.id,
        status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
      },
      include: {
        shift: {
          include: {
            shiftType: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { shift: { start: "desc" } },
    }),

    // Get all friend's shifts (confirmed or pending)
    prisma.signup.findMany({
      where: {
        userId: friendId,
        status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
      },
      include: {
        shift: {
          include: {
            shiftType: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { shift: { start: "desc" } },
    }),

    // Friend's upcoming shifts (if visibility allows)
    prisma.signup.findMany({
      where: {
        userId: friendId,
        status: "CONFIRMED",
        shift: { start: { gte: new Date() } },
      },
      include: {
        shift: {
          include: { shiftType: true },
        },
      },
      orderBy: { shift: { start: "asc" } },
      take: 10,
    }),

    // Friend's completed shifts
    prisma.signup.findMany({
      where: {
        userId: friendId,
        status: "CONFIRMED",
        shift: { end: { lt: new Date() } },
      },
      include: {
        shift: {
          include: { shiftType: true },
        },
      },
      orderBy: { shift: { start: "desc" } },
    }),

    // Friend's total shifts
    prisma.signup.count({
      where: {
        userId: friendId,
        status: "CONFIRMED",
      },
    }),

    // Friend's shifts this month
    prisma.signup.count({
      where: {
        userId: friendId,
        status: "CONFIRMED",
        shift: {
          start: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lt: new Date(
              new Date().getFullYear(),
              new Date().getMonth() + 1,
              1
            ),
          },
        },
      },
    }),

    // Friend's completed shifts in last 6 months (for monthly rate)
    prisma.signup.count({
      where: {
        userId: friendId,
        status: "CONFIRMED",
        shift: {
          end: {
            gte: subMonths(new Date(), 6),
            lt: new Date(),
          },
        },
      },
    }),
  ]);

  // Match shared shifts based on day, AM/PM, and location
  interface SharedShiftMatch {
    id: string; // Use the shift ID for uniqueness
    start: Date;
    location: string | null;
    shiftType: {
      id: string;
      name: string;
    };
    signups: Array<{
      id: string;
      user: {
        id: string;
        name: string | null;
        firstName: string | null;
        lastName: string | null;
      };
    }>;
  }

  const sharedShiftsMap = new Map<string, SharedShiftMatch>();

  // For each user shift, find matching friend shifts
  userShifts.forEach((userSignup) => {
    const userShift = userSignup.shift;
    const userDate = getShiftDate(userShift.start);
    const userIsAM = isAMShift(userShift.start);
    const userLocation = userShift.location || "";

    // Find friend shifts that match
    friendShifts.forEach((friendSignup) => {
      const friendShift = friendSignup.shift;
      const friendDate = getShiftDate(friendShift.start);
      const friendIsAM = isAMShift(friendShift.start);
      const friendLocation = friendShift.location || "";

      // Check if they match: same day, same AM/PM, same location
      if (
        userDate === friendDate &&
        userIsAM === friendIsAM &&
        userLocation === friendLocation
      ) {
        // Create a unique key for this day/time/location combination
        const key = `${userDate}-${userIsAM ? "AM" : "PM"}-${userLocation}`;

        // If we haven't added this combination yet, add it
        if (!sharedShiftsMap.has(key)) {
          // Use the user's shift as the base, but include both signups
          sharedShiftsMap.set(key, {
            id: userShift.id,
            start: userShift.start,
            location: userShift.location,
            shiftType: userShift.shiftType,
            signups: [
              {
                id: userSignup.id,
                user: userSignup.user,
              },
              {
                id: friendSignup.id,
                user: friendSignup.user,
              },
            ],
          });
        }
      }
    });
  });

  // Convert map to array and sort by date (most recent first)
  const sharedShifts = Array.from(sharedShiftsMap.values()).sort(
    (a, b) => b.start.getTime() - a.start.getTime()
  );

  // Calculate friendship stats
  const daysSinceFriendship = differenceInDays(
    new Date(),
    friendship.createdAt
  );

  // Average shifts per month over a fixed 6-month window — matches the admin
  // milestone analytics monthly-rate calculation so the number reflects the
  // volunteer's actual recent rhythm, independent of friendship duration.
  const avgPerMonth = Math.round(friendLast6MonthsShifts / 6);

  // Calculate friend's total hours
  const friendTotalHours = friendCompletedShifts.reduce((total, signup) => {
    const hours = differenceInHours(signup.shift.end, signup.shift.start);
    return total + hours;
  }, 0);

  // Calculate shared stats
  const sharedShiftsCount = sharedShifts.length;

  // Get friend's favorite shift type
  const shiftTypeCounts = friendCompletedShifts.reduce((acc, signup) => {
    const typeName = signup.shift.shiftType.name;
    acc[typeName] = (acc[typeName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const favoriteShiftType = Object.entries(shiftTypeCounts).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  )[0]?.[0];

  const displayName =
    friend.name ||
    `${friend.firstName || ""} ${friend.lastName || ""}`.trim() ||
    friend.email;
  const initials = (
    friend.firstName?.[0] ||
    friend.name?.[0] ||
    friend.email[0]
  ).toUpperCase();

  const now = new Date();

  return (
    <div className="space-y-8">
      {/* Profile header — dark forest panel with sun glow (radial gradient,
          NOT blur-3xl, which escapes the corner clip in Chromium). */}
      <MotionFriendStats delay={0.1}>
        <section className="grain relative overflow-hidden rounded-[2rem] bg-forest-700 p-6 text-cream-50 sm:p-10">
          <div
            className="absolute -right-28 -top-28 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.15),transparent)]"
            aria-hidden
          />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="relative shrink-0">
              <Avatar className="h-24 w-24 ring-4 ring-cream-50/20 sm:h-28 sm:w-28">
                <AvatarImage
                  src={friend.profilePhotoUrl || undefined}
                  alt={displayName}
                />
                <AvatarFallback className="bg-cream-50/15 text-3xl font-semibold text-cream-50 sm:text-4xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <Sparkle className="absolute -right-1 -top-1 h-6 w-6 text-sun-200" />
            </div>
            <div className="flex-1">
              <p className="eyebrow mb-3 flex items-center gap-3 text-sun-200/90">
                <span className="inline-block h-px w-8 bg-sun-200/50" />
                Volunteer whānau
              </p>
              <h1 className="display text-3xl tracking-tight sm:text-5xl">
                {displayName}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-cream-50/75 sm:text-base">
                Friends for {daysSinceFriendship}{" "}
                {daysSinceFriendship === 1 ? "day" : "days"}
              </p>
              {(daysSinceFriendship <= 30 || sharedShiftsCount > 10) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {daysSinceFriendship <= 30 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sun-200 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-forest-700">
                      <Sparkle className="h-2.5 w-2.5" />
                      New friend
                    </span>
                  )}
                  {sharedShiftsCount > 10 && (
                    <span className="inline-flex items-center rounded-full border border-cream-50/30 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-cream-50/90">
                      Close volunteer buddy
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </MotionFriendStats>

      {/* Friendship & activity stats — editorial hairline band */}
      <StatBand
        testId="friend-stats-grid"
        stats={[
          {
            label: "Days Connected",
            value: daysSinceFriendship,
            testId: "days-connected",
          },
          {
            label: "Shared Shifts",
            value: sharedShiftsCount,
            testId: "shared-shifts",
          },
          {
            label: "Total Shifts",
            value: friendTotalShifts,
            testId: "total-shifts",
          },
          {
            label: "Hours Volunteered",
            value: friendTotalHours,
            testId: "hours-volunteered",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Friend's activity summary */}
        <MotionFriendStats delay={0.2}>
          <section className="grain relative h-full overflow-hidden rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
            <p className={`${eyebrowLight} mb-3`}>
              <span className={eyebrowRule} />
              On the tools
            </p>
            <h2 className="display text-2xl tracking-tight text-forest-700 sm:text-3xl dark:text-cream-50">
              {displayName.split(" ")[0]}&apos;s <em>activity</em>
            </h2>

            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-forest-500/15 ring-1 ring-forest-500/15 dark:bg-cream-50/15 dark:ring-cream-50/15">
              <div className="bg-background px-5 py-6">
                <p className="display text-4xl tracking-tight text-forest-700 tabular-nums sm:text-5xl dark:text-cream-50">
                  {friendThisMonthShifts}
                </p>
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.15em] text-forest-500/70 dark:text-cream-50/55">
                  This month
                </p>
              </div>
              <div className="bg-background px-5 py-6">
                <p className="display text-4xl tracking-tight text-forest-700 tabular-nums sm:text-5xl dark:text-cream-50">
                  {avgPerMonth}
                </p>
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.15em] text-forest-500/70 dark:text-cream-50/55">
                  Avg/month · last 6 months
                </p>
              </div>
            </div>

            {favoriteShiftType && (
              <div className="grain relative mt-4 overflow-hidden rounded-2xl bg-sun-100/70 p-5 text-center ring-1 ring-forest-500/10 dark:bg-sun-200/10 dark:ring-cream-50/10">
                <p className="eyebrow text-forest-600/80 dark:text-sun-200/80">
                  Favourite role
                </p>
                <p className="display display-medium mt-2 text-xl tracking-tight text-forest-700 dark:text-cream-50">
                  {favoriteShiftType}
                </p>
                <p className="mt-1 text-sm text-forest-700/70 dark:text-cream-50/65">
                  Completed {shiftTypeCounts[favoriteShiftType]} times
                </p>
              </div>
            )}
          </section>
        </MotionFriendStats>

        {/* Shared volunteering history */}
        <MotionFriendStats delay={0.3}>
          <section className="grain relative h-full overflow-hidden rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
            <p className={`${eyebrowLight} mb-3`}>
              <span className={eyebrowRule} />
              Side by side
            </p>
            <h2 className="display text-2xl tracking-tight text-forest-700 sm:text-3xl dark:text-cream-50">
              Shared <em>volunteering</em>
            </h2>

            {sharedShifts.length > 0 ? (
              <div className="mt-6">
                <ul className="divide-y divide-forest-500/10 dark:divide-cream-50/10">
                  {sharedShifts.slice(0, 5).map((shift) => {
                    const isUpcoming = shift.start >= now;
                    return (
                      <li
                        key={shift.id}
                        className="flex items-center gap-4 py-3"
                      >
                        <div className="w-11 shrink-0 text-center">
                          <div className="eyebrow text-forest-500/70 dark:text-cream-50/55">
                            {formatInNZT(shift.start, "MMM")}
                          </div>
                          <div className="display mt-0.5 text-2xl leading-none text-forest-700 tabular-nums dark:text-cream-50">
                            {formatInNZT(shift.start, "d")}
                          </div>
                        </div>
                        <div className="h-10 w-px shrink-0 bg-forest-500/10 dark:bg-cream-50/15" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-forest-700 dark:text-cream-50">
                            {getShiftPeriodLabel(shift.start)} ·{" "}
                            {shift.location}
                          </p>
                          <p className="text-xs text-forest-700/60 dark:text-cream-50/55">
                            {formatInNZT(shift.start, "MMM d, yyyy")}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${
                            isUpcoming
                              ? "bg-sun-200 text-forest-700"
                              : "border border-forest-500/20 text-forest-700/70 dark:border-cream-50/20 dark:text-cream-50/65"
                          }`}
                        >
                          {isUpcoming ? "Upcoming" : "Completed"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {sharedShifts.length > 5 && (
                  <p className="mt-4 border-t border-forest-500/10 pt-4 text-center text-sm text-forest-700/65 dark:border-cream-50/10 dark:text-cream-50/60">
                    +{sharedShifts.length - 5} more shared shifts
                  </p>
                )}
              </div>
            ) : (
              <div className="px-4 py-12 text-center">
                <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-500/10 dark:bg-cream-50/10">
                  <Calendar
                    className="h-7 w-7 text-forest-500 dark:text-cream-50/70"
                    aria-hidden
                  />
                  <Sparkle className="absolute -right-2 -top-2 h-4 w-4 text-sun-300" />
                </div>
                <h3 className="display text-xl tracking-tight text-forest-700 dark:text-cream-50">
                  No shared shifts <em>yet</em>
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-forest-700/70 dark:text-cream-50/70">
                  Sign up for the same shifts to volunteer together and build
                  memories!
                </p>
                <Link href="/shifts" className={`${pillPrimary} mt-6`}>
                  Browse Shifts
                </Link>
              </div>
            )}
          </section>
        </MotionFriendStats>
      </div>

      {/* Friend's upcoming shifts */}
      {(friend.friendVisibility === "PUBLIC" ||
        friend.friendVisibility === "FRIENDS_ONLY") && (
        <MotionFriendStats delay={0.4}>
          <section className="grain relative overflow-hidden rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={`${eyebrowLight} mb-3`}>
                  <span className={eyebrowRule} />
                  Coming up
                </p>
                <h2 className="display text-2xl tracking-tight text-forest-700 sm:text-3xl dark:text-cream-50">
                  {displayName.split(" ")[0]}&apos;s upcoming <em>shifts</em>
                </h2>
              </div>
              <Link href="/shifts" className={`${pillGhost} w-fit shrink-0`}>
                View All Shifts
              </Link>
            </div>

            {friendUpcomingShifts.length > 0 ? (
              <div className="mt-6 space-y-3">
                {friendUpcomingShifts.map((signup) => (
                  <div
                    key={signup.id}
                    className="flex items-center gap-3 rounded-2xl border border-forest-500/10 bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:gap-5 dark:border-cream-50/10"
                  >
                    <div className="w-11 shrink-0 text-center sm:w-12">
                      <div className="eyebrow text-forest-500/70 dark:text-cream-50/55">
                        {formatInNZT(signup.shift.start, "EEE")}
                      </div>
                      <div className="display mt-0.5 text-2xl leading-none text-forest-700 tabular-nums sm:text-3xl dark:text-cream-50">
                        {formatInNZT(signup.shift.start, "d")}
                      </div>
                    </div>
                    <div className="h-12 w-px shrink-0 bg-forest-500/10 dark:bg-cream-50/15" />
                    <div className="min-w-0 flex-1">
                      <p className="display display-medium text-lg leading-tight tracking-tight text-forest-700 dark:text-cream-50">
                        {signup.shift.shiftType.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-forest-700/70 dark:text-cream-50/65">
                        {signup.shift.location && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" aria-hidden />
                            {signup.shift.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-forest-700 dark:text-cream-50">
                        {formatInNZT(signup.shift.start, "MMM d")}
                      </p>
                      <p className="text-xs text-forest-700/60 dark:text-cream-50/55">
                        {formatInNZT(signup.shift.start, "h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-12 text-center">
                <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-500/10 dark:bg-cream-50/10">
                  <Calendar
                    className="h-7 w-7 text-forest-500 dark:text-cream-50/70"
                    aria-hidden
                  />
                  <Sparkle className="absolute -right-2 -top-2 h-4 w-4 text-sun-300" />
                </div>
                <h3 className="display text-xl tracking-tight text-forest-700 dark:text-cream-50">
                  No upcoming <em>shifts</em>
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-forest-700/70 dark:text-cream-50/70">
                  Check back later to see {displayName.split(" ")[0]}&apos;s
                  schedule.
                </p>
              </div>
            )}
          </section>
        </MotionFriendStats>
      )}
    </div>
  );
}

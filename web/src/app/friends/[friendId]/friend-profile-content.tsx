import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { differenceInDays, differenceInHours, subMonths } from "date-fns";
import { formatInNZT } from "@/lib/timezone";
import { isAMShift, getShiftDate, getShiftPeriodLabel } from "@/lib/concurrent-shifts";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronRight, Sparkles } from "lucide-react";
import { MotionFriendStats } from "@/components/motion-friends";

interface FriendProfileContentProps {
  friendId: string;
}

/**
 * Friend profile — reads top to bottom as a story:
 * identity → the friendship (together bento) → their trophy shelf →
 * their mahi → shared moments → join them on an upcoming shift.
 */
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

  const now = new Date();

  const [
    userShifts,
    friendShifts,
    friendUpcomingShifts,
    friendCompletedShifts,
    friendThisMonthShifts,
    friendLast6MonthsShifts,
    unlockedAchievements,
    activeAchievementCount,
    userFriendships,
    friendFriendships,
  ] = await Promise.all([
    // All user's shifts (confirmed or pending) — for shared-shift matching
    prisma.signup.findMany({
      where: {
        userId: user.id,
        status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
      },
      include: {
        shift: { include: { shiftType: true } },
      },
      orderBy: { shift: { start: "desc" } },
    }),

    // All friend's shifts (confirmed or pending)
    prisma.signup.findMany({
      where: {
        userId: friendId,
        status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
      },
      include: {
        shift: { include: { shiftType: true } },
      },
      orderBy: { shift: { start: "desc" } },
    }),

    // Friend's upcoming shifts
    prisma.signup.findMany({
      where: {
        userId: friendId,
        status: "CONFIRMED",
        shift: { start: { gte: now } },
      },
      include: {
        shift: { include: { shiftType: true } },
      },
      orderBy: { shift: { start: "asc" } },
      take: 5,
    }),

    // Friend's completed shifts
    prisma.signup.findMany({
      where: {
        userId: friendId,
        status: "CONFIRMED",
        shift: { end: { lt: now } },
      },
      include: {
        shift: { include: { shiftType: true } },
      },
      orderBy: { shift: { start: "desc" } },
    }),

    // Friend's shifts this month
    prisma.signup.count({
      where: {
        userId: friendId,
        status: "CONFIRMED",
        shift: {
          start: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
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
          end: { gte: subMonths(now, 6), lt: now },
        },
      },
    }),

    // Friend's unlocked achievements, newest first
    prisma.userAchievement.findMany({
      where: { userId: friendId },
      orderBy: { unlockedAt: "desc" },
      select: {
        unlockedAt: true,
        achievement: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            category: true,
            points: true,
          },
        },
      },
    }),

    prisma.achievement.count({ where: { isActive: true } }),

    // Both friend lists — intersected below for the mutual-friends count
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ userId: user.id }, { friendId: user.id }],
      },
      select: { userId: true, friendId: true },
    }),
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ userId: friendId }, { friendId: friendId }],
      },
      select: { userId: true, friendId: true },
    }),
  ]);

  // Mutual friends — intersect the two friend lists, excluding the pair
  const userFriendIds = new Set(
    userFriendships.map((f) => (f.userId === user.id ? f.friendId : f.userId))
  );
  const mutualFriendsCount = friendFriendships
    .map((f) => (f.userId === friendId ? f.friendId : f.userId))
    .filter((id) => id !== user.id && id !== friendId && userFriendIds.has(id))
    .length;

  // Match shared shifts based on day, AM/PM, and location — deliberately
  // coarser than exact shift-ID matching so different roles worked during the
  // same service (e.g. kitchen vs front of house) still count as volunteering
  // together. One shared "moment" per day/period/location.
  interface SharedShiftMatch {
    id: string;
    start: Date;
    location: string | null;
    shiftType: { id: string; name: string };
  }

  const sharedShiftsMap = new Map<string, SharedShiftMatch>();

  userShifts.forEach((userSignup) => {
    const userShift = userSignup.shift;
    const userDate = getShiftDate(userShift.start);
    const userIsAM = isAMShift(userShift.start);
    const userLocation = userShift.location || "";

    friendShifts.forEach((friendSignup) => {
      const friendShift = friendSignup.shift;
      if (
        userDate === getShiftDate(friendShift.start) &&
        userIsAM === isAMShift(friendShift.start) &&
        userLocation === (friendShift.location || "")
      ) {
        const key = `${userDate}-${userIsAM ? "AM" : "PM"}-${userLocation}`;
        if (!sharedShiftsMap.has(key)) {
          sharedShiftsMap.set(key, {
            id: userShift.id,
            start: userShift.start,
            location: userShift.location,
            shiftType: userShift.shiftType,
          });
        }
      }
    });
  });

  const sharedShifts = Array.from(sharedShiftsMap.values()).sort(
    (a, b) => b.start.getTime() - a.start.getTime()
  );

  // Friendship + activity stats
  const daysSinceFriendship = differenceInDays(now, friendship.createdAt);
  const friendTotalShifts = friendCompletedShifts.length;

  // Fixed 6-month window — matches the admin milestone analytics monthly rate
  const avgPerMonth = Math.round(friendLast6MonthsShifts / 6);

  const friendTotalHours = friendCompletedShifts.reduce((total, signup) => {
    return total + differenceInHours(signup.shift.end, signup.shift.start);
  }, 0);

  const sharedShiftsCount = sharedShifts.length;

  const shiftTypeCounts = friendCompletedShifts.reduce((acc, signup) => {
    const typeName = signup.shift.shiftType.name;
    acc[typeName] = (acc[typeName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const favoriteShiftType = Object.entries(shiftTypeCounts).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  )[0]?.[0];

  // Achievements
  const totalPoints = unlockedAchievements.reduce(
    (sum, ua) => sum + ua.achievement.points,
    0
  );
  const [latestUnlock, ...otherUnlocks] = unlockedAchievements;
  const shelfLimit = 11;
  const shelfItems = otherUnlocks.slice(0, shelfLimit);
  const shelfOverflow = otherUnlocks.length - shelfItems.length;

  const displayName =
    friend.name ||
    `${friend.firstName || ""} ${friend.lastName || ""}`.trim() ||
    friend.email;
  const firstName = friend.firstName || displayName.split(" ")[0];
  const initials = (
    friend.firstName?.[0] ||
    friend.name?.[0] ||
    friend.email[0]
  ).toUpperCase();

  const isNewFriend = daysSinceFriendship <= 30;
  const isCloseBuddy = sharedShiftsCount > 10;

  return (
    <div className="space-y-12" data-testid="friend-profile-content">
      {/* ── Identity: forest hero band ─────────────────────────── */}
      <MotionFriendStats delay={0.05}>
        <section
          data-testid="friend-profile-hero"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-500 to-forest-700 dark:from-forest-600 dark:to-forest-800"
        >
          {/* Sun disc rising over the table — brand accent, kept decorative.
              Soft on small screens where it sits behind the text column. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -bottom-28 h-72 w-72 rounded-full bg-sun-200 opacity-15 sm:opacity-90 dark:opacity-10 dark:sm:opacity-25"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-24 h-56 w-56 rounded-full border-2 border-cream-50/10"
          />
          <div className="relative flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:gap-8 sm:p-10">
            <Avatar className="h-24 w-24 shrink-0 ring-4 ring-cream-50/90 sm:h-28 sm:w-28">
              <AvatarImage
                src={friend.profilePhotoUrl || undefined}
                alt={displayName}
              />
              <AvatarFallback className="bg-forest-100 font-accent text-4xl font-semibold text-forest-600">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cream-50/70">
                Your whānau
              </p>
              <h1 className="text-4xl leading-tight text-cream-50 sm:text-5xl">
                {displayName}
              </h1>
              <p className="text-sm text-cream-50/80">
                Connected since {formatInNZT(friendship.createdAt, "MMMM yyyy")}
                <span className="text-sun-200"> · {daysSinceFriendship} days</span>
              </p>
              {(isNewFriend || isCloseBuddy) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {isNewFriend && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sun-200 px-3 py-1 text-xs font-semibold text-forest-700">
                      <Sparkles className="h-3 w-3" />
                      New friend
                    </span>
                  )}
                  {isCloseBuddy && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-50/15 px-3 py-1 text-xs font-semibold text-cream-50">
                      🤝 Close buddy
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </MotionFriendStats>

      {/* ── Together: asymmetric bento ─────────────────────────── */}
      <MotionFriendStats delay={0.12}>
        <section
          aria-label="Your friendship in numbers"
          className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:grid-rows-2"
          data-testid="friend-stats-grid"
        >
          <div
            data-testid="shared-shifts"
            className="relative col-span-2 row-span-2 flex min-h-[200px] flex-col justify-between overflow-hidden rounded-3xl bg-forest-700 p-7 dark:bg-forest-800"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -left-10 -top-16 h-44 w-44 rounded-full bg-sun-200/10"
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream-50/60">
              Shifts together
            </p>
            <div>
              <p className="font-accent text-7xl font-semibold leading-none tracking-tight text-sun-200 tabular-nums sm:text-8xl">
                {sharedShiftsCount}
              </p>
              <p className="mt-2 text-sm italic text-cream-50/70">
                mahi done side by side
              </p>
            </div>
          </div>

          <BentoStat
            label="Days connected"
            value={daysSinceFriendship}
            testId="days-connected"
          />
          <BentoStat
            label="Mutual friends"
            value={mutualFriendsCount}
            testId="mutual-friends"
          />
          <BentoStat
            label="Their hours"
            value={friendTotalHours}
            testId="hours-volunteered"
          />
          <BentoStat
            label="Their shifts"
            value={friendTotalShifts}
            testId="total-shifts"
          />
        </section>
      </MotionFriendStats>

      {/* ── Trophy shelf: achievements ─────────────────────────── */}
      <MotionFriendStats delay={0.18}>
        <section data-testid="friend-achievements">
          <SectionHeading
            title="Achievements"
            meta={
              unlockedAchievements.length > 0
                ? `${unlockedAchievements.length} of ${activeAchievementCount} unlocked · ${totalPoints} points`
                : undefined
            }
          />
          {latestUnlock ? (
            <div className="space-y-4">
              {/* Featured latest unlock */}
              <div className="relative flex items-center gap-5 overflow-hidden rounded-3xl border border-sun-300/50 bg-gradient-to-r from-sun-100/80 via-card to-card p-5 dark:border-sun-200/25 dark:from-sun-200/15 dark:via-sun-200/[0.04] dark:to-transparent sm:p-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-12 -top-14 h-40 w-40 rounded-full bg-sun-200/40 blur-2xl dark:bg-sun-200/15"
                />
                <AchievementPlate
                  icon={latestUnlock.achievement.icon}
                  size="lg"
                  featured
                />
                <div className="relative min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-500 dark:text-sun-200">
                    Latest unlock
                  </p>
                  <p className="mt-1 truncate font-accent text-xl font-semibold text-foreground">
                    {latestUnlock.achievement.name}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {latestUnlock.achievement.description}
                  </p>
                  <p className="mt-2 text-xs font-medium text-muted-foreground sm:hidden">
                    +{latestUnlock.achievement.points} pts ·{" "}
                    {formatInNZT(latestUnlock.unlockedAt, "MMM d, yyyy")}
                  </p>
                </div>
                <div className="relative hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                  <span className="inline-flex items-center rounded-full bg-forest-500/10 px-3 py-1 text-xs font-bold text-forest-600 dark:bg-sun-200/15 dark:text-sun-200">
                    +{latestUnlock.achievement.points} pts
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {formatInNZT(latestUnlock.unlockedAt, "MMM d, yyyy")}
                  </p>
                </div>
              </div>

              {/* The shelf */}
              {shelfItems.length > 0 && (
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {shelfItems.map((ua) => (
                    <li
                      key={ua.achievement.id}
                      title={`${ua.achievement.description} · unlocked ${formatInNZT(ua.unlockedAt, "MMM d, yyyy")}`}
                      className="group flex flex-col items-center gap-2.5 rounded-2xl border border-border/70 bg-card p-4 pt-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-forest-500/30 hover:shadow-md dark:hover:border-sun-200/30"
                    >
                      <div className="transition-transform duration-200 group-hover:scale-110">
                        <AchievementPlate icon={ua.achievement.icon} />
                      </div>
                      <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground">
                        {ua.achievement.name}
                      </p>
                      <p className="-mt-1 text-[11px] font-medium text-forest-500/80 dark:text-sun-200/70">
                        {ua.achievement.points} pts
                      </p>
                    </li>
                  ))}
                  {shelfOverflow > 0 && (
                    <li className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border p-4 text-center">
                      <p className="font-accent text-2xl font-semibold text-forest-500 dark:text-forest-200">
                        +{shelfOverflow}
                      </p>
                      <p className="text-xs text-muted-foreground">more</p>
                    </li>
                  )}
                </ul>
              )}
            </div>
          ) : (
            <EmptyCanvas
              title="The shelf is waiting"
              subtitle={`${firstName} hasn't unlocked any achievements yet — their first shift will start the collection.`}
            />
          )}
        </section>
      </MotionFriendStats>

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-8">
        {/* ── Their mahi ─────────────────────────────────────── */}
        <MotionFriendStats delay={0.24}>
          <section data-testid="friend-activity">
            <SectionHeading title="Their mahi" />
            <div className="space-y-4">
              <div className="flex divide-x divide-border rounded-2xl border border-border bg-card py-5">
                <RhythmStat value={friendThisMonthShifts} label="This month" />
                <RhythmStat value={avgPerMonth} label="Avg / month" />
                <RhythmStat value={friendTotalShifts} label="All-time" />
              </div>
              {favoriteShiftType && (
                <div className="flex overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="w-1 shrink-0 bg-forest-500 dark:bg-sun-200" />
                  <div className="flex-1 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Favourite role
                    </p>
                    <p className="mt-1.5 font-accent text-xl font-semibold text-foreground">
                      {favoriteShiftType}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Completed {shiftTypeCounts[favoriteShiftType]}{" "}
                      {shiftTypeCounts[favoriteShiftType] === 1 ? "time" : "times"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </MotionFriendStats>

        {/* ── Shared moments ─────────────────────────────────── */}
        <MotionFriendStats delay={0.3}>
          <section data-testid="shared-shifts">
            <SectionHeading title="Shared shifts" />
            {sharedShifts.length > 0 ? (
              <ol>
                {sharedShifts.slice(0, 5).map((shift, idx) => {
                  const isLast =
                    idx === Math.min(sharedShifts.length, 5) - 1;
                  const isUpcoming = shift.start >= now;
                  return (
                    <li key={shift.id} className="flex gap-4">
                      <div className="w-11 shrink-0 text-right">
                        <p className="font-accent text-2xl font-semibold leading-7 text-foreground tabular-nums">
                          {formatInNZT(shift.start, "d")}
                        </p>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {formatInNZT(shift.start, "MMM")}
                        </p>
                      </div>
                      <div className="flex w-3 flex-col items-center pt-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isUpcoming
                              ? "bg-forest-500 dark:bg-sun-200"
                              : "bg-border"
                          }`}
                        />
                        {!isLast && <span className="mt-1 w-px flex-1 bg-border" />}
                      </div>
                      <div className="flex-1 pb-6 pt-0.5">
                        <p className="text-sm font-semibold text-foreground">
                          {getShiftPeriodLabel(shift.start)}
                          {shift.location ? ` · ${shift.location}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatInNZT(shift.start, "EEEE, MMM d yyyy")}
                        </p>
                        {isUpcoming && (
                          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-sun-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-forest-600 dark:bg-sun-200/15 dark:text-sun-200">
                            <span className="h-1 w-1 rounded-full bg-forest-500 dark:bg-sun-200" />
                            Coming up
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyCanvas
                title="No shared shifts yet"
                subtitle={`Sign up for the same shifts to create moments with ${firstName}.`}
                action={
                  <Button asChild size="sm" className="mt-4">
                    <Link href="/shifts">
                      <Calendar className="mr-2 h-4 w-4" />
                      Browse shifts
                    </Link>
                  </Button>
                }
              />
            )}
            {sharedShifts.length > 5 && (
              <p className="mt-1 text-center text-sm italic text-muted-foreground">
                + {sharedShifts.length - 5} more shifts together
              </p>
            )}
          </section>
        </MotionFriendStats>
      </div>

      {/* ── Join them ──────────────────────────────────────────── */}
      <MotionFriendStats delay={0.36}>
        <section data-testid="upcoming-shifts">
          <SectionHeading title={`Join ${firstName}`} />
          {friendUpcomingShifts.length > 0 ? (
            <>
              <p className="-mt-2 mb-4 text-sm text-muted-foreground">
                Pick a shift to sign up alongside {firstName}.
              </p>
              <ul className="space-y-3">
                {friendUpcomingShifts.map((signup) => {
                  const href = signup.shift.location
                    ? `/shifts/details?date=${formatInNZT(signup.shift.start, "yyyy-MM-dd")}&location=${encodeURIComponent(signup.shift.location)}`
                    : "/shifts";
                  return (
                    <li key={signup.id}>
                      <Link
                        href={href}
                        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-forest-500/40 hover:shadow-sm"
                      >
                        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-forest-500/10 dark:bg-forest-100/10">
                          <span className="font-accent text-xl font-semibold leading-6 text-forest-600 tabular-nums dark:text-forest-200">
                            {formatInNZT(signup.shift.start, "d")}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-forest-500/80 dark:text-forest-200/80">
                            {formatInNZT(signup.shift.start, "MMM")}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {signup.shift.shiftType.name}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {signup.shift.location ?? "Location TBC"} ·{" "}
                            {formatInNZT(signup.shift.start, "h:mm a")}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <EmptyCanvas
              title="Quiet for now"
              subtitle={`Check back later — ${firstName}'s upcoming shifts will appear here.`}
            />
          )}
        </section>
      </MotionFriendStats>
    </div>
  );
}

/* ─── Building blocks ───────────────────────────────────────────── */

function SectionHeading({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-4">
      <h2 className="shrink-0 text-2xl text-foreground">{title}</h2>
      <div className="h-px flex-1 self-center bg-border" />
      {meta && (
        <p className="shrink-0 text-xs font-medium text-muted-foreground">
          {meta}
        </p>
      )}
    </div>
  );
}

function BentoStat({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-card p-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="font-accent text-4xl font-semibold leading-none tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

/** Round "plate" tile for an achievement emoji — the restaurant's trophy. */
function AchievementPlate({
  icon,
  size = "md",
  featured = false,
}: {
  icon: string;
  size?: "md" | "lg";
  featured?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b shadow-sm ${
        featured
          ? "from-sun-100 to-cream-200 ring-2 ring-sun-300/70 dark:from-sun-200/25 dark:to-sun-200/[0.06] dark:ring-sun-200/40"
          : "from-cream-100 to-cream-200 ring-1 ring-forest-500/15 dark:from-sun-200/[0.14] dark:to-white/[0.02] dark:ring-sun-200/20"
      } ${size === "lg" ? "h-20 w-20 text-4xl" : "h-14 w-14 text-2xl"}`}
    >
      {/* Inner rim — reads as the lip of a plate */}
      <div
        className={`pointer-events-none absolute rounded-full border border-forest-500/10 dark:border-cream-50/10 ${
          size === "lg" ? "inset-2" : "inset-1.5"
        }`}
      />
      <span className="drop-shadow-sm">{icon}</span>
    </div>
  );
}

function EmptyCanvas({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-forest-500/[0.03] px-6 py-10 text-center dark:bg-white/[0.02]">
      <p className="font-accent text-lg font-semibold text-foreground">
        {title}
      </p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{subtitle}</p>
      {action}
    </div>
  );
}

function RhythmStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <p className="font-accent text-2xl font-semibold text-foreground tabular-nums">
        {value}
      </p>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

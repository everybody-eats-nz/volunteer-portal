import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { differenceInDays } from "date-fns";
import { formatInNZT } from "@/lib/timezone";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StatBand } from "@/components/ui/stat-band";
import { Calendar, Users } from "lucide-react";

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

export async function FriendsStatsContent() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/friends/stats");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, firstName: true, lastName: true },
  });

  if (!user) {
    redirect("/login?callbackUrl=/friends/stats");
  }

  // Get comprehensive friends data and stats
  const [friendsData, friendsShiftStats] = await Promise.all([
    // Friends with their basic info and recent activity
    // Query only where userId matches to avoid double counting from bidirectional records
    prisma.friendship.findMany({
      where: {
        userId: user.id,
        status: "ACCEPTED",
      },
      include: {
        friend: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePhotoUrl: true,
            friendVisibility: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    // Friends' upcoming shifts (for those with appropriate visibility)
    prisma.signup.findMany({
      where: {
        status: "CONFIRMED",
        shift: { start: { gte: new Date() } },
        user: {
          AND: [
            {
              OR: [
                {
                  friendships: {
                    some: {
                      friendId: user.id,
                      status: "ACCEPTED",
                    },
                  },
                },
                {
                  friendOf: {
                    some: {
                      userId: user.id,
                      status: "ACCEPTED",
                    },
                  },
                },
              ],
            },
            {
              friendVisibility: {
                in: ["PUBLIC", "FRIENDS_ONLY"],
              },
            },
          ],
        },
      },
      include: {
        shift: {
          include: { shiftType: true },
        },
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
      orderBy: { shift: { start: "asc" } },
      take: 20,
    }),
  ]);

  // Process friends data to get the friend objects
  const friends = friendsData.map((friendship) => {
    const friendshipDate = friendship.createdAt;
    const daysSinceFriendship = differenceInDays(new Date(), friendshipDate);

    return {
      ...friendship.friend,
      friendshipDate,
      daysSinceFriendship,
    };
  });

  // Group friends' upcoming shifts by friend
  const friendsUpcomingShifts = friendsShiftStats.reduce(
    (acc, signup) => {
      const friendId = signup.user.id;
      if (!acc[friendId]) {
        acc[friendId] = {
          friend: signup.user,
          shifts: [],
        };
      }
      acc[friendId].shifts.push(signup);
      return acc;
    },
    {} as Record<
      string,
      {
        friend: (typeof friendsShiftStats)[0]["user"];
        shifts: typeof friendsShiftStats;
      }
    >
  );

  // Calculate friendship stats
  const totalFriends = friends.length;
  const recentFriends = friends.filter(
    (f) => f.daysSinceFriendship <= 30
  ).length;
  const activeFriends = Object.keys(friendsUpcomingShifts).length;
  const averageFriendshipDays =
    totalFriends > 0
      ? Math.round(
          friends.reduce((sum, f) => sum + f.daysSinceFriendship, 0) /
            totalFriends
        )
      : 0;

  // Find most active friend (most upcoming shifts)
  const mostActiveFriend = Object.values(friendsUpcomingShifts).sort(
    (a, b) => b.shifts.length - a.shifts.length
  )[0];

  return (
    <div className="space-y-8">
      {/* Stats overview — editorial hairline band, matching the landing
          page's "mahi in numbers" treatment. */}
      <StatBand
        testId="friends-stats-grid"
        stats={[
          {
            label: "Total Friends",
            value: totalFriends,
            testId: "total-friends",
          },
          {
            label: "Active This Month",
            value: activeFriends,
            testId: "active-friends",
          },
          {
            label: "New This Month",
            value: recentFriends,
            testId: "recent-friends",
          },
          {
            label: "Avg. Days Connected",
            value: averageFriendshipDays,
            testId: "avg-days-connected",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent friendships */}
        <section className="grain relative overflow-hidden rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
          <p className={`${eyebrowLight} mb-3`}>
            <span className={eyebrowRule} />
            Newest connections
          </p>
          <h2 className="display text-2xl tracking-tight text-forest-700 sm:text-3xl dark:text-cream-50">
            Recent <em>friendships</em>
          </h2>

          {friends.slice(0, 5).length > 0 ? (
            <div className="mt-6">
              <ul className="divide-y divide-forest-500/10 dark:divide-cream-50/10">
                {friends.slice(0, 5).map((friend) => {
                  const displayName =
                    friend.name ||
                    `${friend.firstName || ""} ${
                      friend.lastName || ""
                    }`.trim() ||
                    friend.email;
                  const initials = (
                    friend.firstName?.[0] ||
                    friend.name?.[0] ||
                    friend.email[0]
                  ).toUpperCase();

                  return (
                    <li key={friend.id}>
                      <Link
                        href={`/friends/${friend.id}`}
                        className="group flex items-center gap-3 py-3 transition-colors hover:bg-forest-500/5 sm:px-2 dark:hover:bg-cream-50/5"
                      >
                        <Avatar className="h-10 w-10 ring-2 ring-forest-500/15 dark:ring-cream-50/15">
                          <AvatarImage
                            src={friend.profilePhotoUrl || undefined}
                            alt={displayName}
                          />
                          <AvatarFallback className="bg-forest-500/10 font-semibold text-forest-700 dark:bg-cream-50/10 dark:text-cream-50">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="display display-medium truncate leading-tight tracking-tight text-forest-700 dark:text-cream-50">
                            {displayName}
                          </p>
                          <p className="text-xs text-forest-700/65 dark:text-cream-50/60">
                            Friends for {friend.daysSinceFriendship} days
                          </p>
                        </div>
                        {friend.daysSinceFriendship <= 7 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sun-200 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-forest-700">
                            New
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-forest-500/20 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-forest-700/70 dark:border-cream-50/20 dark:text-cream-50/65">
                            Connected
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {friends.length > 5 && (
                <Link href="/friends" className={`${pillGhost} mt-6 w-full`}>
                  View All Friends
                </Link>
              )}
            </div>
          ) : (
            <div className="px-4 py-12 text-center">
              <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-500/10 dark:bg-cream-50/10">
                <Users
                  className="h-7 w-7 text-forest-500 dark:text-cream-50/70"
                  aria-hidden
                />
                <Sparkle className="absolute -right-2 -top-2 h-4 w-4 text-sun-300" />
              </div>
              <p className="leading-relaxed text-forest-700/70 dark:text-cream-50/70">
                No friends yet — your whānau starts here.
              </p>
              <Link href="/friends" className={`${pillGhost} mt-6`}>
                Find Friends
              </Link>
            </div>
          )}
        </section>

        {/* Most active friend — dark spotlight panel with sun glow (radial
            gradient, NOT blur-3xl, which escapes the corner clip in Chromium). */}
        <section className="grain relative overflow-hidden rounded-[2rem] bg-forest-700 p-6 text-cream-50 sm:p-8">
          <div
            className="absolute -bottom-28 -right-28 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.16),transparent)]"
            aria-hidden
          />
          <div className="relative">
            <p className="eyebrow mb-3 flex items-center gap-3 text-sun-200/90">
              <span className="inline-block h-px w-8 bg-sun-200/50" />
              Busy in the kitchen
            </p>
            <h2 className="display text-2xl tracking-tight sm:text-3xl">
              Most active <em>friend</em>
            </h2>

            {mostActiveFriend ? (
              <div className="mt-6 space-y-6">
                <Link
                  href={`/friends/${mostActiveFriend.friend.id}`}
                  className="group flex items-center gap-4"
                >
                  {(() => {
                    const friend = mostActiveFriend.friend;
                    const displayName =
                      friend.name ||
                      `${friend.firstName || ""} ${
                        friend.lastName || ""
                      }`.trim() ||
                      friend.email;
                    const initials = (
                      friend.firstName?.[0] ||
                      friend.name?.[0] ||
                      friend.email[0]
                    ).toUpperCase();

                    return (
                      <>
                        <Avatar className="h-16 w-16 ring-2 ring-sun-200/40">
                          <AvatarImage
                            src={friend.profilePhotoUrl || undefined}
                            alt={displayName}
                          />
                          <AvatarFallback className="bg-cream-50/15 text-lg font-semibold text-cream-50">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="display display-medium text-xl leading-tight tracking-tight group-hover:underline group-hover:underline-offset-4">
                            {displayName}
                          </p>
                          <p className="text-sm text-cream-50/75">
                            {mostActiveFriend.shifts.length} upcoming shifts
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </Link>
                <div>
                  <p className="eyebrow mb-3 text-cream-50/60">
                    Upcoming shifts
                  </p>
                  <ul className="space-y-2">
                    {mostActiveFriend.shifts.slice(0, 3).map((signup, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-3 rounded-2xl bg-cream-50/[0.07] px-4 py-3 text-sm ring-1 ring-cream-50/10"
                      >
                        <Sparkle className="h-3.5 w-3.5 shrink-0 text-sun-200" />
                        <span className="font-medium">
                          {signup.shift.shiftType.name}
                        </span>
                        <span className="ml-auto shrink-0 text-cream-50/70">
                          {formatInNZT(signup.shift.start, "MMM d, h:mm a")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {mostActiveFriend.shifts.length > 3 && (
                    <p className="mt-3 text-sm text-cream-50/65">
                      +{mostActiveFriend.shifts.length - 3} more shifts
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-4 py-12 text-center">
                <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-50/10">
                  <Calendar className="h-7 w-7 text-cream-50/70" aria-hidden />
                  <Sparkle className="absolute -right-2 -top-2 h-4 w-4 text-sun-200" />
                </div>
                <p className="leading-relaxed text-cream-50/75">
                  No active friends this month — nudge the whānau toward a
                  shift!
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Friends' upcoming activity */}
      {Object.keys(friendsUpcomingShifts).length > 0 && (
        <section className="grain relative overflow-hidden rounded-[2rem] border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
          <p className={`${eyebrowLight} mb-3`}>
            <span className={eyebrowRule} />
            Out on the floor soon
          </p>
          <h2 className="display text-2xl tracking-tight text-forest-700 sm:text-3xl dark:text-cream-50">
            Friends&apos; upcoming <em>activity</em>
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {Object.values(friendsUpcomingShifts)
              .slice(0, 6)
              .map(({ friend, shifts }) => {
                const displayName =
                  friend.name ||
                  `${friend.firstName || ""} ${friend.lastName || ""}`.trim() ||
                  friend.email;
                const initials = (
                  friend.firstName?.[0] ||
                  friend.name?.[0] ||
                  friend.email[0]
                ).toUpperCase();

                return (
                  <Link
                    key={friend.id}
                    href={`/friends/${friend.id}`}
                    className="group flex items-start gap-3 rounded-2xl border border-forest-500/10 bg-background p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-cream-50/10"
                  >
                    <Avatar className="h-10 w-10 shrink-0 ring-2 ring-forest-500/15 dark:ring-cream-50/15">
                      <AvatarImage
                        src={friend.profilePhotoUrl || undefined}
                        alt={displayName}
                      />
                      <AvatarFallback className="bg-forest-500/10 font-semibold text-forest-700 dark:bg-cream-50/10 dark:text-cream-50">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="display display-medium truncate leading-tight tracking-tight text-forest-700 dark:text-cream-50">
                        {displayName}
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {shifts.slice(0, 2).map((signup, index) => (
                          <p
                            key={index}
                            className="flex items-center gap-1.5 text-xs text-forest-700/65 dark:text-cream-50/60"
                          >
                            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">
                              {signup.shift.shiftType.name} ·{" "}
                              {formatInNZT(signup.shift.start, "MMM d, h:mm a")}
                            </span>
                          </p>
                        ))}
                        {shifts.length > 2 && (
                          <p className="text-xs text-forest-700/55 dark:text-cream-50/50">
                            +{shifts.length - 2} more shifts
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-sun-100 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-forest-700 dark:bg-sun-200/15 dark:text-sun-100">
                      {shifts.length} shift{shifts.length !== 1 ? "s" : ""}
                    </span>
                  </Link>
                );
              })}
          </div>
          <div className="mt-6">
            <Link href="/shifts" className={pillGhost}>
              View All Shifts
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AnimatedStatsGrid } from "@/components/animated-stats-grid";
import {
  ArrowLeft,
  Users,
  Calendar,
  Clock,
  TrendingUp,
  Heart,
  UserCheck,
  Handshake,
  Sparkles,
} from "lucide-react";
import {
  MotionCard,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/motion-card";
import { MotionPageContainer } from "@/components/motion-page-container";
import { MotionFriendStats } from "@/components/motion-friends";

export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ friendId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/friends");
  }

  const { friendId } = await params;

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
    sharedShifts,
    friendUpcomingShifts,
    friendCompletedShifts,
    friendTotalShifts,
    friendThisMonthShifts,
  ] = await Promise.all([
    // Shifts where both users were signed up (completed or confirmed)
    prisma.shift.findMany({
      where: {
        signups: {
          some: {
            userId: user.id,
            status: { in: ["CONFIRMED", "PENDING"] },
          },
        },
        AND: {
          signups: {
            some: {
              userId: friendId,
              status: { in: ["CONFIRMED", "PENDING"] },
            },
          },
        },
      },
      include: {
        shiftType: true,
        signups: {
          where: {
            userId: { in: [user.id, friendId] },
            status: { in: ["CONFIRMED", "PENDING"] },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { start: "desc" },
      take: 10,
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
  ]);

  // Calculate friendship stats
  const daysSinceFriendship = differenceInDays(
    new Date(),
    friendship.createdAt
  );
  const friendshipMonths = Math.max(1, Math.floor(daysSinceFriendship / 30));

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

  return (
    <MotionPageContainer testid="friend-profile-page">
      <div className="space-y-8">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="hover:bg-accent/50">
            <Link href="/friends" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Friends</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </Button>
        </div>

        {/* Enhanced Friend Profile Header */}
        <MotionFriendStats delay={0.1}>
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/5 via-background to-background shadow-md">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
            <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24 sm:h-28 sm:w-28 ring-4 ring-primary/20 ring-offset-4 ring-offset-background shadow-lg">
                  <AvatarImage
                    src={friend.profilePhotoUrl || undefined}
                    alt={displayName}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary/40 to-primary/20 text-primary text-3xl sm:text-4xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full border-4 border-background flex items-center justify-center shadow-lg">
                  <Heart className="w-5 h-5 text-white fill-white" />
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                    {displayName}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>Friends for {daysSinceFriendship} days</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                      <Handshake className="h-4 w-4 text-primary" />
                      <span>Volunteer friend</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {daysSinceFriendship <= 30 && (
                    <Badge
                      variant="secondary"
                      className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      New Friend
                    </Badge>
                  )}
                  {sharedShiftsCount > 10 && (
                    <Badge
                      variant="secondary"
                      className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                    >
                      <Handshake className="h-3 w-3 mr-1" />
                      Close Volunteer Buddy
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </MotionFriendStats>

        {/* Enhanced Friendship & Activity Stats */}
        <AnimatedStatsGrid
          data-testid="friend-stats-grid"
          stats={[
            {
              title: "Days Connected",
              value: daysSinceFriendship,
              iconType: "heart",
              variant: "red",
              testId: "days-connected",
            },
            {
              title: "Shared Shifts",
              value: sharedShiftsCount,
              iconType: "handshake",
              variant: "green",
              testId: "shared-shifts",
            },
            {
              title: "Total Shifts",
              value: friendTotalShifts,
              iconType: "trendingUp",
              variant: "blue",
              testId: "total-shifts",
            },
            {
              title: "Hours Volunteered",
              value: friendTotalHours,
              iconType: "clock",
              variant: "purple",
              testId: "hours-volunteered",
            },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Enhanced Friend's Activity Summary */}
          <MotionFriendStats delay={0.2}>
            <MotionCard className="overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center shadow-sm">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xl">{displayName}&apos;s Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="group p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-xl border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-md">
                    <p className="text-4xl font-bold text-primary mb-2 group-hover:scale-110 transition-transform">
                      {friendThisMonthShifts}
                    </p>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                      This Month
                    </p>
                  </div>
                  <div className="group p-5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-background rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:shadow-md">
                    <p className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2 group-hover:scale-110 transition-transform">
                      {Math.round(friendTotalShifts / friendshipMonths)}
                    </p>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                      Avg/Month
                    </p>
                  </div>
                </div>
                {favoriteShiftType && (
                  <div className="text-center p-5 bg-gradient-to-br from-muted/50 to-background rounded-xl border border-border hover:border-primary/30 transition-all duration-300">
                    <Badge variant="outline" className="mb-3 bg-background shadow-sm">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Favorite Role
                    </Badge>
                    <p className="font-bold text-xl mb-1 text-foreground">
                      {favoriteShiftType}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Completed {shiftTypeCounts[favoriteShiftType]} times
                    </p>
                  </div>
                )}
              </CardContent>
            </MotionCard>
          </MotionFriendStats>

          {/* Enhanced Shared Volunteering History */}
          <MotionFriendStats delay={0.3}>
            <MotionCard className="overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-xl flex items-center justify-center shadow-sm">
                    <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-xl">Shared Volunteering</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sharedShifts.length > 0 ? (
                  <div className="space-y-3">
                    {sharedShifts.slice(0, 5).map((shift) => (
                      <div
                        key={shift.id}
                        className="group flex items-center gap-4 p-4 rounded-xl hover:bg-muted/50 transition-all duration-200 border border-transparent hover:border-border hover:shadow-sm"
                      >
                        <div className="w-3 h-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex-shrink-0 group-hover:scale-125 group-hover:shadow-lg transition-all" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate mb-1">
                            {shift.shiftType.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(shift.start, "MMM d, yyyy")} •{" "}
                            {shift.location}
                          </p>
                        </div>
                        <Badge
                          variant={
                            shift.start >= new Date() ? "default" : "secondary"
                          }
                          className="text-xs shadow-sm"
                        >
                          {shift.start >= new Date() ? "Upcoming" : "Completed"}
                        </Badge>
                      </div>
                    ))}
                    {sharedShifts.length > 5 && (
                      <div className="text-center pt-4 border-t border-border/50">
                        <p className="text-sm font-medium text-muted-foreground">
                          +{sharedShifts.length - 5} more shared shifts
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="relative w-20 h-20 mx-auto mb-5">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full blur-xl"></div>
                      <div className="relative w-full h-full bg-gradient-to-br from-muted/80 to-muted/40 rounded-full flex items-center justify-center">
                        <UserCheck className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-2">No shared shifts yet</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                      Sign up for the same shifts to volunteer together and build memories!
                    </p>
                    <Button
                      asChild
                      size="default"
                      className="shadow-md hover:shadow-lg transition-all"
                    >
                      <Link href="/shifts">
                        <Calendar className="h-4 w-4 mr-2" />
                        Browse Shifts
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </MotionCard>
          </MotionFriendStats>
        </div>

        {/* Friend's Upcoming Shifts */}
        {(friend.friendVisibility === "PUBLIC" ||
          friend.friendVisibility === "FRIENDS_ONLY") && (
          <MotionFriendStats delay={0.4}>
            <MotionCard>
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-blue-500/10 rounded-xl flex items-center justify-center shadow-sm">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-xl">{displayName}&apos;s Upcoming Shifts</span>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shadow-sm hover:shadow-md transition-all">
                    <Link href="/shifts">View All Shifts</Link>
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {friendUpcomingShifts.length > 0 ? (
                  <div className="space-y-3">
                    {friendUpcomingShifts.map((signup) => (
                      <div
                        key={signup.id}
                        className="group flex items-center gap-4 p-4 border border-border rounded-xl hover:bg-accent/50 hover:border-primary/30 transition-all duration-200 hover:shadow-sm"
                      >
                        <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                          <Calendar className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold mb-1">
                            {signup.shift.shiftType.name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {signup.shift.location}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-foreground">
                            {format(signup.shift.start, "MMM d")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(signup.shift.start, "h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="relative w-20 h-20 mx-auto mb-5">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-primary/20 rounded-full blur-xl"></div>
                      <div className="relative w-full h-full bg-gradient-to-br from-muted/80 to-muted/40 rounded-full flex items-center justify-center">
                        <Calendar className="h-10 w-10 text-muted-foreground/50" />
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-2">No upcoming shifts</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      Check back later to see {displayName}&apos;s schedule
                    </p>
                  </div>
                )}
              </CardContent>
            </MotionCard>
          </MotionFriendStats>
        )}
      </div>
    </MotionPageContainer>
  );
}

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { AnimatedStatsGrid } from "@/components/animated-stats-grid";
import { ArrowLeft, Users, Calendar, TrendingUp, Heart } from "lucide-react";

export default async function FriendsStatsPage() {
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
    prisma.friendship.findMany({
      where: {
        AND: [
          {
            OR: [{ userId: user.id }, { friendId: user.id }],
          },
          { status: "ACCEPTED" },
        ],
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
            friendVisibility: true,
          },
        },
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
    const friend =
      friendship.userId === user.id ? friendship.friend : friendship.user;
    const friendshipDate = friendship.createdAt;
    const daysSinceFriendship = differenceInDays(new Date(), friendshipDate);

    return {
      ...friend,
      friendshipDate,
      daysSinceFriendship,
    };
  });

  // Group friends' upcoming shifts by friend
  const friendsUpcomingShifts = friendsShiftStats.reduce((acc, signup) => {
    const friendId = signup.user.id;
    if (!acc[friendId]) {
      acc[friendId] = {
        friend: signup.user,
        shifts: [],
      };
    }
    acc[friendId].shifts.push(signup);
    return acc;
  }, {} as Record<string, { friend: (typeof friendsShiftStats)[0]["user"]; shifts: typeof friendsShiftStats }>);

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
    <PageContainer testid="friends-stats-page">
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/friends" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Friends
            </Link>
          </Button>
        </div>

        <PageHeader
          title="Friendship Statistics"
          description="Your volunteer community connections and friendship insights"
        />

        {/* Stats Overview */}
        <AnimatedStatsGrid
          data-testid="friends-stats-grid"
          stats={[
            {
              title: "Total Friends",
              value: totalFriends,
              iconType: "checkCircle",
              variant: "amber",
              testId: "total-friends",
            },
            {
              title: "Active This Month",
              value: activeFriends,
              iconType: "calendar",
              variant: "green",
              testId: "active-friends",
            },
            {
              title: "New This Month",
              value: recentFriends,
              iconType: "trendingUp",
              variant: "blue",
              testId: "recent-friends",
            },
            {
              title: "Avg. Days Connected",
              value: averageFriendshipDays,
              iconType: "clock",
              variant: "purple",
              testId: "avg-days-connected",
            },
          ]}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Friends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Recent Friendships
              </CardTitle>
            </CardHeader>
            <CardContent>
              {friends.slice(0, 5).length > 0 ? (
                <div className="space-y-3">
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
                      <Link key={friend.id} href={`/friends/${friend.id}`}>
                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={friend.profilePhotoUrl || undefined}
                              alt={displayName}
                            />
                            <AvatarFallback className="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{displayName}</p>
                            <p className="text-sm text-muted-foreground">
                              Friends for {friend.daysSinceFriendship} days
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {friend.daysSinceFriendship <= 7
                              ? "New"
                              : "Connected"}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                  {friends.length > 5 && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Link href="/friends">View All Friends</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No friends yet</p>
                  <Button asChild size="sm" className="mt-2">
                    <Link href="/friends">Find Friends</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Most Active Friend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Most Active Friend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mostActiveFriend ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
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
                          <Avatar className="h-16 w-16">
                            <AvatarImage
                              src={friend.profilePhotoUrl || undefined}
                              alt={displayName}
                            />
                            <AvatarFallback className="bg-primary/10 text-primary text-lg">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-lg">
                              {displayName}
                            </p>
                            <p className="text-muted-foreground">
                              {mostActiveFriend.shifts.length} upcoming shifts
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Upcoming Shifts:</p>
                    {mostActiveFriend.shifts
                      .slice(0, 3)
                      .map((signup, index) => (
                        <div
                          key={index}
                          className="text-sm p-2 bg-muted/50 rounded"
                        >
                          <span className="font-medium">
                            {signup.shift.shiftType.name}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            {format(signup.shift.start, "MMM d, h:mm a")}
                          </span>
                        </div>
                      ))}
                    {mostActiveFriend.shifts.length > 3 && (
                      <p className="text-sm text-muted-foreground">
                        +{mostActiveFriend.shifts.length - 3} more shifts
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No active friends this month</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Friends' Upcoming Activity */}
        {Object.keys(friendsUpcomingShifts).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Friends&apos; Upcoming Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.values(friendsUpcomingShifts)
                  .slice(0, 6)
                  .map(({ friend, shifts }) => {
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
                      <Link
                        key={friend.id}
                        href={`/friends/${friend.id}`}
                        className="block"
                      >
                        <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={friend.profilePhotoUrl || undefined}
                              alt={displayName}
                            />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{displayName}</p>
                            <div className="mt-1 space-y-1">
                              {shifts.slice(0, 2).map((signup, index) => (
                                <p
                                  key={index}
                                  className="text-xs text-muted-foreground"
                                >
                                  {signup.shift.shiftType.name} •{" "}
                                  {format(signup.shift.start, "MMM d, h:mm a")}
                                </p>
                              ))}
                              {shifts.length > 2 && (
                                <p className="text-xs text-muted-foreground">
                                  +{shifts.length - 2} more shifts
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {shifts.length} shift
                            {shifts.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/shifts">View All Shifts</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}

import { prisma } from "@/lib/prisma";
import { format, formatDistanceToNow } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Star as StarIcon, User as UserIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { LOCATIONS, LocationOption } from "@/lib/locations";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;

  // Normalize and validate selected location
  const rawLocation = Array.isArray(params.location)
    ? params.location[0]
    : params.location;
  const selectedLocation: LocationOption | undefined = LOCATIONS.includes(
    (rawLocation as LocationOption) ?? ("" as LocationOption)
  )
    ? (rawLocation as LocationOption)
    : undefined;

  const now = new Date();

  // Create location filter for queries
  const locationFilter = selectedLocation ? { location: selectedLocation } : {};

  // Get comprehensive admin statistics
  const [
    totalUsers,
    totalVolunteers,
    totalAdmins,
    totalShifts,
    upcomingShifts,
    pastShifts,
    totalSignups,
    confirmedSignups,
    pendingSignups,
    waitlistedSignups,
    recentSignups,
    nextShift,
    shiftsNeedingAttention,
    monthlyStats,
  ] = await Promise.all([
    // User counts
    prisma.user.count(),
    prisma.user.count({ where: { role: "VOLUNTEER" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),

    // Shift counts (filtered by location)
    prisma.shift.count({ where: locationFilter }),
    prisma.shift.count({ where: { start: { gte: now }, ...locationFilter } }),
    prisma.shift.count({ where: { start: { lt: now }, ...locationFilter } }),

    // Signup counts (for shifts in selected location)
    prisma.signup.count({
      where: selectedLocation ? { shift: { location: selectedLocation } } : {},
    }),
    prisma.signup.count({
      where: {
        status: "CONFIRMED",
        ...(selectedLocation ? { shift: { location: selectedLocation } } : {}),
      },
    }),
    prisma.signup.count({
      where: {
        status: "PENDING",
        ...(selectedLocation ? { shift: { location: selectedLocation } } : {}),
      },
    }),
    prisma.signup.count({
      where: {
        status: "WAITLISTED",
        ...(selectedLocation ? { shift: { location: selectedLocation } } : {}),
      },
    }),

    // Recent activity (filtered by location)
    prisma.signup.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      where: selectedLocation ? { shift: { location: selectedLocation } } : {},
      include: {
        user: { select: { id: true, name: true, email: true } },
        shift: {
          select: {
            start: true,
            location: true,
            shiftType: { select: { name: true } },
          },
        },
      },
    }),

    // Next upcoming shift (filtered by location)
    prisma.shift.findFirst({
      where: { start: { gte: now }, ...locationFilter },
      orderBy: { start: "asc" },
      include: {
        shiftType: true,
        signups: {
          include: { user: { select: { name: true } } },
        },
      },
    }),

    // Shifts needing attention (filtered by location)
    prisma.shift.findMany({
      where: {
        start: { gte: now },
        ...locationFilter,
      },
      include: {
        shiftType: true,
        signups: { where: { status: "CONFIRMED" } },
      },
      orderBy: { start: "asc" },
      take: 5,
    }),

    // Monthly statistics (filtered by location)
    Promise.all([
      prisma.shift.count({
        where: {
          start: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
          ...locationFilter,
        },
      }),
      prisma.signup.count({
        where: {
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
          ...(selectedLocation
            ? { shift: { location: selectedLocation } }
            : {}),
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        },
      }),
    ]),

    // Get all locations that have shifts for the filter dropdown
    prisma.shift.findMany({
      select: { location: true },
      distinct: ["location"],
      where: { location: { not: null } },
    }),
  ]);

  const [monthlyShifts, monthlySignups, newUsersThisMonth] = monthlyStats;

  // Define types for better type safety
  type ShiftWithSignups = {
    id: string;
    capacity: number;
    shiftType: { name: string };
    signups: Array<{ status: string }>;
  };

  // Filter shifts that need attention (less than 50% capacity filled)
  const lowSignupShifts = shiftsNeedingAttention.filter(
    (shift: ShiftWithSignups) => {
      const confirmedCount = shift.signups.length;
      const fillRate = shift.capacity > 0 ? confirmedCount / shift.capacity : 0;
      return fillRate < 0.5;
    }
  );

  return (
    <AdminPageWrapper
      title="Admin Dashboard"
      description="Overview of volunteer portal activity and management tools."
    >
      <div data-testid="admin-dashboard-page" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Compact location filter using tabs */}
          <div className="flex flex-col gap-2">
            <span
              className="text-sm font-medium text-muted-foreground"
              data-testid="location-filter-label"
            >
              Filter by location:
            </span>
            <Tabs value={selectedLocation || "all"} className="w-fit">
              <TabsList className="bg-accent-subtle">
                <TabsTrigger value="all" asChild>
                  <Link href="/admin" data-testid="location-filter-all">
                    All
                  </Link>
                </TabsTrigger>
                {LOCATIONS.map((loc) => (
                  <TabsTrigger key={loc} value={loc} asChild>
                    <Link
                      href={{ pathname: "/admin", query: { location: loc } }}
                      data-testid={`location-filter-${loc
                        .toLowerCase()
                        .replace(" ", "-")}`}
                    >
                      {loc}
                    </Link>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card data-testid="total-users-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p
                className="text-xs text-muted-foreground"
                data-testid="users-breakdown"
              >
                {totalVolunteers} volunteers, {totalAdmins} admins
              </p>
            </CardContent>
          </Card>

          <Card data-testid="total-shifts-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Shifts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalShifts}</div>
              <p
                className="text-xs text-muted-foreground"
                data-testid="shifts-breakdown"
              >
                {upcomingShifts} upcoming, {pastShifts} completed
              </p>
            </CardContent>
          </Card>

          <Card
            data-testid="total-signups-card"
            className={
              pendingSignups > 0 ? "border-orange-200 bg-orange-50" : ""
            }
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Total Signups
                {pendingSignups > 0 && (
                  <Badge
                    className="bg-orange-100 text-orange-800 border-orange-200"
                    data-testid="pending-signups-badge"
                  >
                    {pendingSignups} pending
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSignups}</div>
              <p
                className="text-xs text-muted-foreground"
                data-testid="signups-breakdown"
              >
                {confirmedSignups} confirmed, {pendingSignups} pending,{" "}
                {waitlistedSignups} waitlisted
              </p>
            </CardContent>
          </Card>

          <Card data-testid="this-month-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlySignups}</div>
              <p
                className="text-xs text-muted-foreground"
                data-testid="monthly-signups-text"
              >
                signups for {monthlyShifts} shifts
              </p>
              <p
                className="text-xs text-muted-foreground"
                data-testid="monthly-new-users-text"
              >
                {newUsersThisMonth} new users
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle data-testid="quick-actions-heading">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                asChild
                className="w-full btn-primary"
                data-testid="create-shift-button"
              >
                <Link href="/admin/shifts/new">Create New Shift</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full"
                data-testid="dashboard-manage-shifts-button"
              >
                <Link href="/admin/shifts">Manage All Shifts</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full"
                data-testid="dashboard-manage-users-button"
              >
                <Link href="/admin/users">Manage Users</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full"
                data-testid="restaurant-managers-button"
              >
                <Link href="/admin/restaurant-managers">
                  Restaurant Managers
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full"
                data-testid="user-migration-button"
              >
                <Link href="/admin/migration">User Migration</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full"
                data-testid="dashboard-view-public-shifts-button"
              >
                <Link href="/shifts">View Public Shifts</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Next Upcoming Shift */}
          <Card>
            <CardHeader>
              <CardTitle data-testid="next-shift-heading">Next Shift</CardTitle>
            </CardHeader>
            <CardContent>
              {nextShift ? (
                <div className="space-y-2">
                  <h4 className="font-medium">{nextShift.shiftType.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {format(nextShift.start, "PPp")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    📍 {nextShift.location}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {
                        nextShift.signups.filter(
                          (s: { status: string }) => s.status === "CONFIRMED"
                        ).length
                      }{" "}
                      / {nextShift.capacity}
                    </Badge>
                    <span
                      className="text-xs text-muted-foreground"
                      data-testid="shift-volunteers-badge"
                    >
                      volunteers
                    </span>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="w-full mt-2"
                    data-testid="view-shift-details-button"
                  >
                    <Link href={`/admin/shifts?upcoming=true`}>
                      View Details
                    </Link>
                  </Button>
                </div>
              ) : (
                <p
                  className="text-muted-foreground text-sm"
                  data-testid="no-upcoming-shifts"
                >
                  No upcoming shifts scheduled
                </p>
              )}
            </CardContent>
          </Card>

          {/* Shifts Needing Attention */}
          <Card>
            <CardHeader>
              <CardTitle data-testid="needs-attention-heading">
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowSignupShifts.length > 0 ? (
                <div className="space-y-3">
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="low-signup-rates-text"
                  >
                    {lowSignupShifts.length} shifts with low signup rates
                  </p>
                  {lowSignupShifts
                    .slice(0, 2)
                    .map((shift: ShiftWithSignups) => {
                      const confirmedCount = shift.signups.length;
                      const fillRate =
                        shift.capacity > 0
                          ? (confirmedCount / shift.capacity) * 100
                          : 0;
                      return (
                        <div key={shift.id} className="text-sm">
                          <div className="font-medium truncate">
                            {shift.shiftType.name}
                          </div>
                          <div className="text-muted-foreground">
                            {confirmedCount}/{shift.capacity} (
                            {Math.round(fillRate)}% filled)
                          </div>
                        </div>
                      );
                    })}
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="w-full"
                    data-testid="review-all-button"
                  >
                    <Link href="/admin/shifts">Review All</Link>
                  </Button>
                </div>
              ) : (
                <p
                  className="text-muted-foreground text-sm"
                  data-testid="good-signup-rates-message"
                >
                  All upcoming shifts have good signup rates!{" "}
                  <span data-testid="celebration-emoji">🎉</span>
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button asChild className="h-auto p-4 flex-col gap-2">
                <Link href="/admin/shifts/new">
                  <Plus className="h-5 w-5" />
                  <span className="font-medium">Create Shift</span>
                  <span className="text-xs opacity-75">
                    Schedule new volunteer shifts
                  </span>
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-auto p-4 flex-col gap-2"
              >
                <Link href="/admin/regulars">
                  <StarIcon className="h-5 w-5" />
                  <span className="font-medium">Regular Volunteers</span>
                  <span className="text-xs opacity-75">
                    Manage recurring assignments
                  </span>
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-auto p-4 flex-col gap-2"
              >
                <Link href="/admin/users">
                  <UserIcon className="h-5 w-5" />
                  <span className="font-medium">User Management</span>
                  <span className="text-xs opacity-75">
                    View and manage volunteers
                  </span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle data-testid="recent-signups-heading">
              Recent Signups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSignups.length > 0 ? (
              <div className="space-y-3">
                {recentSignups.map((signup) => (
                  <div
                    key={signup.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {signup.user.name ? (
                          <Link
                            href={`/admin/volunteers/${signup.user.id}`}
                            className="hover:underline"
                          >
                            {signup.user.name}
                          </Link>
                        ) : (
                          signup.user.email
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {signup.shift.shiftType.name} -{" "}
                        {format(signup.shift.start, "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          signup.status === "CONFIRMED"
                            ? "default"
                            : signup.status === "PENDING"
                            ? "outline"
                            : signup.status === "WAITLISTED"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {signup.status.toLowerCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(signup.createdAt, {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p
                className="text-muted-foreground text-sm"
                data-testid="no-recent-signups"
              >
                No recent signups
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminPageWrapper>
  );
}

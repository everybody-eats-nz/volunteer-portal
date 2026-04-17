import { prisma } from "@/lib/prisma";
import { formatInNZT, toNZT, toUTC, getStartOfDayUTC } from "@/lib/timezone";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { LocationOption } from "@/lib/locations";
import { AdminDashboardStats } from "@/components/admin-dashboard-stats";
import { AdminDashboardAttention } from "@/components/admin-dashboard-attention";
import {
  AdminDashboardUpcomingShifts,
  type UpcomingShiftData,
} from "@/components/admin-dashboard-upcoming-shifts";
import { AdminDashboardQuickActions } from "@/components/admin-dashboard-quick-actions";
import { AdminDashboardWeekSummary } from "@/components/admin-dashboard-week-summary";
import {
  AdminDashboardRecentActivity,
  type ActivityItem,
} from "@/components/admin-dashboard-recent-activity";

interface AdminDashboardContentProps {
  selectedLocation: LocationOption | undefined;
  sessionUserId: string;
}

export async function AdminDashboardContent({
  selectedLocation,
  sessionUserId,
}: AdminDashboardContentProps) {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Start of current week (Monday) in NZ timezone
  const nowNZT = toNZT(now);
  const dayOfWeekNZT = nowNZT.getDay();
  const daysFromMondayNZT = dayOfWeekNZT === 0 ? 6 : dayOfWeekNZT - 1;
  const startOfWeekNZT = toNZT(now);
  startOfWeekNZT.setDate(startOfWeekNZT.getDate() - daysFromMondayNZT);
  startOfWeekNZT.setHours(0, 0, 0, 0);
  const startOfWeek = toUTC(startOfWeekNZT);
  const endOfWeekNZT = toNZT(startOfWeek);
  endOfWeekNZT.setDate(endOfWeekNZT.getDate() + 7);
  const endOfWeek = toUTC(endOfWeekNZT);

  const locationFilter = selectedLocation
    ? { location: selectedLocation }
    : {};

  const [
    totalUsers,
    totalVolunteers,
    totalAdmins,
    upcomingShiftsCount,
    pastShifts,
    pendingSignups,
    signupsLast7Days,
    signupsLast30Days,
    adminPasskeyCount,
    recentSignups,
    upcomingShiftsData,
    monthlyStats,
    pendingParentalConsent,
    recentSurveyResponses,
    recentFriendships,
    recentAchievements,
    weeklyStats,
  ] = await Promise.all([
    // User counts (active only)
    prisma.user.count({ where: { archivedAt: null } }),
    prisma.user.count({ where: { role: "VOLUNTEER", archivedAt: null } }),
    prisma.user.count({ where: { role: "ADMIN", archivedAt: null } }),

    // Shift counts
    prisma.shift.count({ where: { start: { gte: now }, ...locationFilter } }),
    prisma.shift.count({ where: { start: { lt: now }, ...locationFilter } }),

    // Pending signups
    prisma.signup.count({
      where: {
        status: "PENDING",
        ...(selectedLocation ? { shift: { location: selectedLocation } } : {}),
      },
    }),

    // Time-based signup counts
    prisma.signup.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
        ...(selectedLocation ? { shift: { location: selectedLocation } } : {}),
      },
    }),
    prisma.signup.count({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        ...(selectedLocation ? { shift: { location: selectedLocation } } : {}),
      },
    }),

    // Check if current admin has passkeys
    prisma.passkey.count({
      where: { userId: sessionUserId },
    }),

    // Recent activity
    prisma.signup.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      where: selectedLocation ? { shift: { location: selectedLocation } } : {},
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePhotoUrl: true,
            _count: { select: { signups: true } },
          },
        },
        shift: {
          select: {
            id: true,
            start: true,
            location: true,
            shiftType: { select: { name: true } },
          },
        },
      },
    }),

    // Upcoming shifts with signups (for both display and attention)
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
      take: 10,
    }),

    // Monthly statistics
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

    // Pending parental consent
    prisma.user.count({
      where: {
        requiresParentalConsent: true,
        parentalConsentReceived: false,
      },
    }),

    // Recent survey responses
    prisma.surveyResponse.findMany({
      take: 5,
      orderBy: { submittedAt: "desc" },
      include: {
        assignment: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profilePhotoUrl: true,
              },
            },
            survey: { select: { id: true, title: true } },
          },
        },
      },
    }),

    // Recent accepted friendships
    prisma.friendship.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      where: { status: "ACCEPTED" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePhotoUrl: true,
          },
        },
        friend: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePhotoUrl: true,
          },
        },
      },
    }),

    // Recent achievement unlocks
    prisma.userAchievement.findMany({
      take: 5,
      orderBy: { unlockedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePhotoUrl: true,
          },
        },
        achievement: { select: { name: true, icon: true } },
      },
    }),

    // This week stats
    Promise.all([
      // Days with shifts remaining this week
      prisma.shift.findMany({
        where: {
          start: { gte: now, lt: endOfWeek },
          ...locationFilter,
        },
        select: { start: true },
      }),
      // Confirmed signups this week
      prisma.signup.count({
        where: {
          status: "CONFIRMED",
          shift: {
            start: { gte: startOfWeek, lt: endOfWeek },
            ...locationFilter,
          },
        },
      }),
      // New users this week
      prisma.user.count({
        where: {
          createdAt: { gte: startOfWeek, lt: endOfWeek },
          ...(selectedLocation
            ? { availableLocations: { contains: selectedLocation } }
            : {}),
        },
      }),
      // Meals served this week (individual records for fallback logic)
      prisma.mealsServed.findMany({
        where: {
          date: { gte: startOfWeek, lt: endOfWeek },
          ...(selectedLocation ? { location: selectedLocation } : {}),
        },
      }),
      // Hours volunteered this week (sum of shift durations * confirmed volunteers)
      prisma.shift.findMany({
        where: {
          start: { gte: startOfWeek, lt: endOfWeek },
          ...locationFilter,
        },
        select: {
          start: true,
          end: true,
          location: true,
          placeholderCount: true,
          _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
        },
      }),
      // Location defaults for meals served fallback
      prisma.location.findMany({
        where: { isActive: true },
        select: { name: true, defaultMealsServed: true },
      }),
    ]),
  ]);

  const [monthlyShifts, monthlySignups, newUsersThisMonth] = monthlyStats;
  const [
    weekRemainingShifts,
    weekSignups,
    weekNewUsers,
    weekMealsRecords,
    weekShiftDetails,
    weekLocationDefaults,
  ] = weeklyStats;
  const weekDaysWithShifts = new Set(
    weekRemainingShifts.map((s) => formatInNZT(s.start, "yyyy-MM-dd"))
  ).size;

  // Calculate meals served with fallback to location defaults
  const actualMealsMap = new Map<string, number>();
  for (const record of weekMealsRecords) {
    const key = `${record.date.toISOString()}-${record.location}`;
    actualMealsMap.set(key, record.mealsServed);
  }
  const defaultMealsMap = new Map<string, number>();
  for (const loc of weekLocationDefaults) {
    defaultMealsMap.set(loc.name, loc.defaultMealsServed);
  }
  // Get unique date-location pairs from completed shifts this week
  const shiftDateLocations = new Map<string, string>();
  for (const shift of weekShiftDetails) {
    if (new Date(shift.end) > now) continue; // Skip shifts that haven't finished
    const dateUTC = getStartOfDayUTC(shift.start);
    const location = shift.location || "";
    const key = `${dateUTC.toISOString()}-${location}`;
    if (!shiftDateLocations.has(key)) {
      shiftDateLocations.set(key, location);
    }
  }
  let weekMeals = 0;
  for (const [key, location] of shiftDateLocations) {
    if (actualMealsMap.has(key)) {
      weekMeals += actualMealsMap.get(key)!;
    } else if (defaultMealsMap.has(location)) {
      weekMeals += defaultMealsMap.get(location)!;
    }
  }
  const weekVolunteerHours = weekShiftDetails.reduce((total, shift) => {
    if (new Date(shift.end) > now) return total; // Skip shifts that haven't finished
    const hours =
      (new Date(shift.end).getTime() - new Date(shift.start).getTime()) /
      (1000 * 60 * 60);
    const volunteers = shift._count.signups + shift.placeholderCount;
    return total + hours * volunteers;
  }, 0);

  // Compute low fill rate shifts (< 50% capacity)
  const lowFillShifts = upcomingShiftsData
    .map((shift) => {
      const confirmedCount = shift.signups.length + shift.placeholderCount;
      const fillRate =
        shift.capacity > 0 ? confirmedCount / shift.capacity : 0;
      return {
        id: shift.id,
        name: shift.shiftType.name,
        confirmed: confirmedCount,
        capacity: shift.capacity,
        fillRate,
      };
    })
    .filter((s) => s.fillRate < 0.5);

  // Serialize upcoming shifts grouped by day for client component
  const shiftsByDay = new Map<
    string,
    { label: string; dateParam: string; shifts: UpcomingShiftData[] }
  >();
  for (const shift of upcomingShiftsData) {
    const dateParam = formatInNZT(shift.start, "yyyy-MM-dd");
    if (!shiftsByDay.has(dateParam)) {
      shiftsByDay.set(dateParam, {
        label: formatInNZT(shift.start, "EEEE, d MMM"),
        dateParam,
        shifts: [],
      });
    }
    shiftsByDay.get(dateParam)!.shifts.push({
      id: shift.id,
      shiftTypeName: shift.shiftType.name,
      formattedDate: formatInNZT(shift.start, "h:mm a"),
      dateParam,
      location: shift.location,
      capacity: shift.capacity,
      confirmedCount: shift.signups.length + shift.placeholderCount,
    });
  }
  const upcomingShiftDays = Array.from(shiftsByDay.values()).slice(0, 5);

  // Build unified activity feed
  const activityItems: ActivityItem[] = [];

  // Signups
  for (const signup of recentSignups) {
    activityItems.push({
      type: "signup",
      id: `signup-${signup.id}`,
      timestamp: signup.createdAt.toISOString(),
      userId: signup.user.id,
      userName: signup.user.name,
      userEmail: signup.user.email ?? "",
      userPhoto: signup.user.profilePhotoUrl,
      shiftId: signup.shift.id,
      shiftTypeName: signup.shift.shiftType.name,
      shiftDate: formatInNZT(signup.shift.start, "EEE d MMM"),
      shiftTime: formatInNZT(signup.shift.start, "h:mm a"),
      shiftDateParam: formatInNZT(signup.shift.start, "yyyy-MM-dd"),
      shiftLocation: signup.shift.location,
      status: signup.status,
      isFirstSignup: signup.user._count.signups === 1,
    });
  }

  // Survey responses
  for (const response of recentSurveyResponses) {
    activityItems.push({
      type: "survey",
      id: `survey-${response.id}`,
      timestamp: response.submittedAt.toISOString(),
      userId: response.assignment.user.id,
      userName: response.assignment.user.name,
      userEmail: response.assignment.user.email ?? "",
      userPhoto: response.assignment.user.profilePhotoUrl,
      surveyTitle: response.assignment.survey.title,
      surveyId: response.assignment.survey.id,
    });
  }

  // Friendships
  for (const friendship of recentFriendships) {
    activityItems.push({
      type: "friendship",
      id: `friendship-${friendship.id}`,
      timestamp: friendship.updatedAt.toISOString(),
      userId: friendship.user.id,
      userName: friendship.user.name,
      userEmail: friendship.user.email ?? "",
      userPhoto: friendship.user.profilePhotoUrl,
      friendName: friendship.friend.name,
      friendId: friendship.friend.id,
    });
  }

  // Achievements
  for (const unlock of recentAchievements) {
    activityItems.push({
      type: "achievement",
      id: `achievement-${unlock.id}`,
      timestamp: unlock.unlockedAt.toISOString(),
      userId: unlock.user.id,
      userName: unlock.user.name,
      userEmail: unlock.user.email ?? "",
      userPhoto: unlock.user.profilePhotoUrl,
      achievementName: unlock.achievement.name,
      achievementIcon: unlock.achievement.icon,
    });
  }

  // Sort by timestamp descending, take top 10
  activityItems.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const recentActivity = activityItems.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Passkey Setup Notice */}
      {adminPasskeyCount === 0 && (
        <Alert
          data-testid="passkey-setup-notice"
          className="border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-950/30"
        >
          <ShieldAlert className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            Enhance Your Account Security
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            Set up passkey authentication for faster, more secure sign-ins
            using your fingerprint, face, or device PIN.{" "}
            <Link
              href="/profile/edit?step=security"
              className="font-medium underline underline-offset-4 hover:text-blue-600 dark:hover:text-blue-300"
              data-testid="setup-passkey-link"
            >
              Set up passkey now
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <AdminDashboardStats
        totalVolunteers={totalVolunteers}
        totalAdmins={totalAdmins}
        totalUsers={totalUsers}
        upcomingShifts={upcomingShiftsCount}
        pastShifts={pastShifts}
        signupsLast7Days={signupsLast7Days}
        signupsLast30Days={signupsLast30Days}
        pendingSignups={pendingSignups}
        monthlySignups={monthlySignups}
        monthlyShifts={monthlyShifts}
        newUsersThisMonth={newUsersThisMonth}
      />

      {/* Attention Required + This Week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <AdminDashboardAttention
          pendingSignups={pendingSignups}
          lowFillShifts={lowFillShifts}
          pendingParentalConsent={pendingParentalConsent}
        />
        <AdminDashboardWeekSummary
          weekShifts={weekDaysWithShifts}
          weekSignups={weekSignups}
          weekVolunteerHours={weekVolunteerHours}
          weekMeals={weekMeals}
          weekNewUsers={weekNewUsers}
        />
      </div>

      {/* Upcoming Shifts + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <AdminDashboardUpcomingShifts days={upcomingShiftDays} />
        <AdminDashboardQuickActions />
      </div>

      {/* Recent Activity */}
      <AdminDashboardRecentActivity items={recentActivity} />
    </div>
  );
}

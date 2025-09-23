import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { formatInNZT, toUTC, parseISOInNZT } from "@/lib/timezone";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isFeatureEnabled } from "@/lib/posthog-server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AvatarList } from "@/components/ui/avatar-list";
import { ShiftSignupDialog } from "@/components/shift-signup-dialog";
import { CancelSignupButton } from "../mine/cancel-signup-button";
import { PageHeader } from "@/components/page-header";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  UserCheck,
  ArrowLeft,
} from "lucide-react";
import { GroupBookingDialogWrapper } from "@/components/group-booking-dialog-wrapper";
import { PageContainer } from "@/components/page-container";
import { getShiftTheme } from "@/lib/shift-themes";
import { ShiftsProfileCompletionBanner } from "@/components/shifts-profile-completion-banner";
import { Suspense } from "react";
import { checkProfileCompletion } from "@/lib/profile-completion";

function getDurationInHours(start: Date, end: Date): string {
  const durationMs = end.getTime() - start.getTime();
  const hours = durationMs / (1000 * 60 * 60);
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return minutes === 0 ? `${wholeHours}h` : `${wholeHours}h ${minutes}m`;
}

interface ShiftWithRelations {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  capacity: number;
  notes: string | null;
  shiftType: {
    id: string;
    name: string;
    description: string | null;
  };
  signups: Array<{
    id: string;
    userId: string;
    status: string;
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      email: string;
      profilePhotoUrl: string | null;
    };
  }>;
  groupBookings: Array<{
    id: string;
    name: string;
    status: string;
    signups: Array<{
      id: string;
      userId: string;
      status: string;
    }>;
  }>;
}

function ShiftCard({
  shift,
  currentUserId,
  session,
  userFriendIds = [],
  canSignUp = true,
  needsParentalConsent = false,
}: {
  shift: ShiftWithRelations;
  currentUserId?: string;
  session: unknown;
  userFriendIds?: string[];
  canSignUp?: boolean;
  needsParentalConsent?: boolean;
}) {
  const theme = getShiftTheme(shift.shiftType.name);
  const duration = getDurationInHours(shift.start, shift.end);

  // Calculate signup counts
  let confirmedCount = 0;
  let pendingCount = 0;

  for (const signup of shift.signups) {
    if (signup.status === "CONFIRMED") confirmedCount += 1;
    if (signup.status === "PENDING") pendingCount += 1;
  }

  const remaining = Math.max(0, shift.capacity - confirmedCount - pendingCount);
  const isFull = remaining === 0;

  // Check if user has existing signup
  const mySignup = currentUserId
    ? shift.signups.find(
        (s) => s.userId === currentUserId && s.status !== "CANCELED"
      )
    : undefined;

  // Find friends who have signed up for this shift
  const friendSignups = shift.signups.filter(
    (signup) =>
      userFriendIds.includes(signup.userId) && signup.status === "CONFIRMED"
  );

  return (
    <Card
      data-testid={`shift-card-${shift.id}`}
      className={`group relative overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${theme.bgColor} h-full`}
    >
      {/* Gradient accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.fullGradient}`}
      />

      <CardContent className="p-6 h-full">
        <div className="flex flex-col h-full">
          <div className="space-y-4 flex-1">
            {/* Header with emoji and title */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`p-2 rounded-xl bg-gradient-to-br ${theme.fullGradient} shadow-lg flex items-center justify-center text-white text-lg font-medium`}
                >
                  {theme.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-xl text-gray-900 dark:text-white truncate mb-1">
                    {shift.shiftType.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`text-xs font-medium text-gray-700 dark:text-gray-200 ${theme.bgColor} border ${theme.borderColor}`}
                    >
                      {duration}
                    </Badge>
                    {mySignup && (
                      <Badge
                        variant={
                          mySignup.status === "CONFIRMED"
                            ? "default"
                            : "secondary"
                        }
                        className={`text-xs font-medium ${
                          mySignup.status === "CONFIRMED"
                            ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700"
                            : "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700"
                        }`}
                      >
                        {mySignup.status === "CONFIRMED"
                          ? "✅ Confirmed"
                          : mySignup.status === "PENDING"
                          ? "⏳ Pending"
                          : "⏳ Waitlisted"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {shift.shiftType.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
                {shift.shiftType.description}
              </p>
            )}

            {/* Time and capacity info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 p-3 bg-white/50 dark:bg-gray-800/30 rounded-lg">
                <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <div className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatInNZT(shift.start, "h:mm a")}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    to {formatInNZT(shift.end, "h:mm a")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-white/50 dark:bg-gray-800/30 rounded-lg">
                <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <div className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {confirmedCount + pendingCount}/{shift.capacity}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {remaining > 0 ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {remaining} spots left
                      </span>
                    ) : (
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        Full
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Friends participating */}
            {friendSignups.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-100 dark:border-green-800/50">
                <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    {friendSignups.length} friend
                    {friendSignups.length !== 1 ? "s" : ""} joining:
                  </span>
                  <AvatarList
                    users={friendSignups.map((signup) => signup.user)}
                    size="sm"
                    maxDisplay={3}
                  />
                </div>
              </div>
            )}

            {/* Group bookings indicator */}
            {shift.groupBookings.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-100 dark:border-purple-800/50">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  {shift.groupBookings.length} group booking
                  {shift.groupBookings.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Action button - anchored to bottom */}
          <div className="pt-4 mt-auto">
            {mySignup ? (
              <CancelSignupButton
                shiftId={shift.id}
                shiftName={shift.shiftType.name}
                className="w-full"
              />
            ) : session ? (
              canSignUp ? (
                <ShiftSignupDialog
                  shift={{
                    id: shift.id,
                    start: shift.start,
                    end: shift.end,
                    location: shift.location,
                    capacity: shift.capacity,
                    shiftType: {
                      name: shift.shiftType.name,
                      description: shift.shiftType.description,
                    },
                  }}
                  confirmedCount={confirmedCount}
                  isWaitlist={isFull}
                  currentUserId={currentUserId}
                >
                  <Button
                    data-testid="shift-signup-button"
                    className={`w-full font-medium transition-all duration-200 ${
                      isFull
                        ? "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 hover:border-orange-300"
                        : "bg-gradient-to-r " +
                          theme.fullGradient +
                          " hover:shadow-lg transform hover:scale-[1.02] text-white"
                    }`}
                    variant={isFull ? "outline" : "default"}
                  >
                    {isFull ? "🎯 Join Waitlist" : "✨ Sign Up Now"}
                  </Button>
                </ShiftSignupDialog>
              ) : (
                <Button
                  disabled
                  data-testid="shift-signup-button-disabled"
                  className="w-full font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  variant="outline"
                >
                  {needsParentalConsent
                    ? "Parental Consent Required"
                    : isFull
                    ? "Complete Profile to Join Waitlist"
                    : "Complete Profile to Sign Up"}
                </Button>
              )
            ) : (
              <Button
                asChild
                className={`w-full font-medium bg-gradient-to-r ${theme.fullGradient} hover:shadow-lg transform hover:scale-[1.02] text-white transition-all duration-200`}
              >
                <Link href="/login?callbackUrl=/shifts/details">✨ Sign Up Now</Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ShiftDetailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;

  // Get date and location from params
  const dateParam = Array.isArray(params.date) ? params.date[0] : params.date;
  const locationParam = Array.isArray(params.location) ? params.location[0] : params.location;

  if (!dateParam) {
    // Redirect to calendar if no date specified
    return (
      <PageContainer>
        <div className="text-center py-20">
          <Calendar className="w-20 h-20 text-muted-foreground mx-auto mb-6" />
          <h3 className="text-2xl font-semibold mb-3">No Date Selected</h3>
          <p className="text-muted-foreground mb-6">
            Please select a date from the calendar to view available shifts.
          </p>
          <Button asChild>
            <Link href="/shifts">Back to Calendar</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  const selectedDate = parseISOInNZT(dateParam);
  const selectedLocation = locationParam ? decodeURIComponent(locationParam) : undefined;

  // Get current user and their friends
  let currentUser = null;
  let userFriendIds: string[] = [];

  if (session?.user?.email) {
    currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, availableLocations: true },
    });

    // Get user's friend IDs
    if (currentUser?.id) {
      const friendships = await prisma.friendship.findMany({
        where: {
          AND: [
            {
              OR: [{ userId: currentUser.id }, { friendId: currentUser.id }],
            },
            { status: "ACCEPTED" },
          ],
        },
        select: {
          userId: true,
          friendId: true,
        },
      });

      userFriendIds = friendships.map((friendship) =>
        friendship.userId === currentUser!.id
          ? friendship.friendId
          : friendship.userId
      );
    }
  }

  // Check profile completion status for button state
  let canSignUpForShifts = true;
  let needsParentalConsent = false;
  if (currentUser?.id) {
    const profileStatus = await checkProfileCompletion(currentUser.id);
    canSignUpForShifts = profileStatus.canSignUpForShifts;
    needsParentalConsent = profileStatus.needsParentalConsent || false;
  }


  // Check feature flag for flexible placement
  const userId = currentUser?.id || "anonymous";
  const isFlexiblePlacementEnabled = await isFeatureEnabled("flexible-placement", userId);

  // Fetch shifts for the specific date and optionally location (using NZ timezone)
  // Calculate day boundaries in NZ timezone - selectedDate is already in NZT
  const startOfDayNZ = startOfDay(selectedDate);
  const endOfDayNZ = endOfDay(selectedDate);
  
  // Convert TZDate objects to explicit UTC for reliable Prisma queries
  const startOfDayUTC = toUTC(startOfDayNZ);
  const endOfDayUTC = toUTC(endOfDayNZ);
  
  const allShifts = (await prisma.shift.findMany({
    where: {
      start: {
        gte: startOfDayUTC,
        lte: endOfDayUTC,
      },
      ...(selectedLocation ? { location: selectedLocation } : {}),
    },
    orderBy: { start: "asc" },
    include: {
      shiftType: true,
      signups: {
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
      groupBookings: {
        include: {
          signups: true,
        },
      },
    },
  })) as ShiftWithRelations[];

  // Filter out flexible placement shifts if feature is disabled
  const shifts = isFlexiblePlacementEnabled 
    ? allShifts
    : allShifts.filter(shift => !shift.shiftType.name.includes("Anywhere I'm Needed"));

  // Helper function to determine if a shift is AM or PM (using NZ timezone)
  const isAMShift = (shift: ShiftWithRelations) => {
    const hour = parseInt(formatInNZT(shift.start, "HH"));
    return hour < 16; // Before 4pm (16:00) is considered "AM"
  };

  // Group shifts by location and then by AM/PM
  const shiftsByLocationAndTime = new Map<string, { AM: ShiftWithRelations[]; PM: ShiftWithRelations[] }>();
  for (const shift of shifts) {
    const locationKey = shift.location || "TBD";
    const timeOfDay = isAMShift(shift) ? "AM" : "PM";
    
    if (!shiftsByLocationAndTime.has(locationKey)) {
      shiftsByLocationAndTime.set(locationKey, { AM: [], PM: [] });
    }
    shiftsByLocationAndTime.get(locationKey)![timeOfDay].push(shift);
  }

  const sortedLocations = Array.from(shiftsByLocationAndTime.keys()).sort();

  return (
    <PageContainer testid="shifts-details-page">
      {/* Back button */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={selectedLocation ? `/shifts?location=${encodeURIComponent(selectedLocation)}` : "/shifts"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Calendar
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Shifts for ${formatInNZT(selectedDate, "EEEE, MMMM d, yyyy")}${selectedLocation ? ` - ${selectedLocation}` : ""}`}
        description={`${selectedLocation ? `Available shifts in ${selectedLocation}` : "All available shifts"} for this date. Click on any shift to view details and sign up.`}
        className="mb-8"
        data-testid="shifts-details-page-header"
      />

      {/* Profile completion banner - shows if profile incomplete */}
      <Suspense fallback={null}>
        <ShiftsProfileCompletionBanner />
      </Suspense>

      {shifts.length === 0 ? (
        <div className="text-center py-20" data-testid="empty-state">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-10 h-10 text-primary/60" />
          </div>
          <h3 className="text-2xl font-semibold mb-3" data-testid="empty-state-title">
            No shifts scheduled
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto" data-testid="empty-state-description">
            No shifts are scheduled for {formatInNZT(selectedDate, "MMMM d, yyyy")}
            {selectedLocation ? ` in ${selectedLocation}` : ""}.
          </p>
          <div className="mt-6 space-x-4">
            <Button asChild variant="outline">
              <Link href="/shifts">View Other Dates</Link>
            </Button>
            {selectedLocation && (
              <Button asChild>
                <Link href={`/shifts/details?date=${dateParam}`}>View All Locations</Link>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8" data-testid="shifts-list">
          {sortedLocations.map((locationKey) => {
            const locationTimeShifts = shiftsByLocationAndTime.get(locationKey)!;
            const totalShifts = locationTimeShifts.AM.length + locationTimeShifts.PM.length;
            const hasAMShifts = locationTimeShifts.AM.length > 0;
            const hasPMShifts = locationTimeShifts.PM.length > 0;

            if (!hasAMShifts && !hasPMShifts) return null;

            return (
              <section
                key={locationKey}
                className="space-y-6"
                data-testid={`shifts-location-section-${locationKey.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {/* Location Header (only show if multiple locations) */}
                {!selectedLocation && sortedLocations.length > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-primary" />
                      <div>
                        <h2 className="text-xl font-semibold">{locationKey}</h2>
                        <p className="text-sm text-muted-foreground">
                          {totalShifts} shift{totalShifts !== 1 ? "s" : ""} available
                        </p>
                      </div>
                    </div>

                    {/* Group Booking Button at Location Level */}
                    {session && (
                      <GroupBookingDialogWrapper
                        shifts={[...locationTimeShifts.AM, ...locationTimeShifts.PM]}
                        date={formatInNZT(selectedDate, "EEEE, MMMM d, yyyy")}
                        location={locationKey}
                        testid={`group-booking-${locationKey.toLowerCase().replace(/\s+/g, "-")}`}
                        currentUserEmail={session.user?.email || undefined}
                      />
                    )}
                  </div>
                )}

                {/* AM Shifts Section */}
                {hasAMShifts && (
                  <div className="space-y-4" data-testid={`shifts-am-section-${locationKey.toLowerCase().replace(/\s+/g, "-")}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-lg">
                        ☀️
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Day Shifts</h3>
                        <p className="text-sm text-muted-foreground">
                          {locationTimeShifts.AM.length} shift{locationTimeShifts.AM.length !== 1 ? "s" : ""} available (before 4pm)
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {locationTimeShifts.AM.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
                          currentUserId={currentUser?.id}
                          session={session}
                          userFriendIds={userFriendIds}
                          canSignUp={canSignUpForShifts}
                          needsParentalConsent={needsParentalConsent}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* PM Shifts Section */}
                {hasPMShifts && (
                  <div className="space-y-4" data-testid={`shifts-pm-section-${locationKey.toLowerCase().replace(/\s+/g, "-")}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-lg">
                        🌙
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Evening Shifts</h3>
                        <p className="text-sm text-muted-foreground">
                          {locationTimeShifts.PM.length} shift{locationTimeShifts.PM.length !== 1 ? "s" : ""} available (4pm onwards)
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {locationTimeShifts.PM.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
                          currentUserId={currentUser?.id}
                          session={session}
                          userFriendIds={userFriendIds}
                          canSignUp={canSignUpForShifts}
                          needsParentalConsent={needsParentalConsent}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
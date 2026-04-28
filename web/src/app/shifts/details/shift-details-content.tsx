import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { formatInNZT, toUTC, toNZT } from "@/lib/timezone";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AvatarList } from "@/components/ui/avatar-list";
import { CancelSignupButton } from "../mine/cancel-signup-button";
import { ShiftSignupButton } from "@/components/shift-signup-button";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  UserCheck,
} from "lucide-react";
import { getShiftTheme } from "@/lib/shift-themes";
import { checkProfileCompletion } from "@/lib/profile-completion";

function getDurationInHours(start: Date, end: Date): string {
  const durationMs = end.getTime() - start.getTime();
  const hours = durationMs / (1000 * 60 * 60);
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return minutes === 0 ? `${wholeHours}h` : `${wholeHours}h ${minutes}m`;
}

function isAMShiftHelper(shiftStart: Date): boolean {
  const nzTime = toNZT(shiftStart);
  const hour = nzTime.getHours();
  return hour < 16;
}

function getShiftDateHelper(shiftStart: Date): string {
  return formatInNZT(shiftStart, "yyyy-MM-dd");
}

function getConcurrentShiftsFromList(
  targetShift: ShiftWithRelations,
  allShifts: ShiftWithRelations[]
) {
  const targetDate = getShiftDateHelper(targetShift.start);
  const targetIsAM = isAMShiftHelper(targetShift.start);

  return allShifts
    .filter((shift) => {
      if (shift.id === targetShift.id) return false;
      if (shift.location !== targetShift.location) return false;
      const shiftDate = getShiftDateHelper(shift.start);
      const shiftIsAM = isAMShiftHelper(shift.start);
      return shiftDate === targetDate && shiftIsAM === targetIsAM;
    })
    .map((shift) => {
      const confirmedCount = shift.signups.filter(
        (s) => s.status === "CONFIRMED" || s.status === "PENDING" || s.status === "REGULAR_PENDING"
      ).length + (shift._count?.placeholders ?? 0);
      return {
        id: shift.id,
        shiftTypeName: shift.shiftType.name,
        shiftTypeDescription: shift.shiftType.description,
        spotsRemaining: Math.max(0, shift.capacity - confirmedCount),
      };
    });
}

interface ShiftWithRelations {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  capacity: number;
  notes: string | null;
  _count: {
    placeholders: number;
  };
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
}

function ShiftCard({
  shift,
  currentUserId,
  session,
  userFriendIds = [],
  canSignUp = true,
  needsParentalConsent = false,
  allShifts = [],
}: {
  shift: ShiftWithRelations;
  currentUserId?: string;
  session: unknown;
  userFriendIds?: string[];
  canSignUp?: boolean;
  needsParentalConsent?: boolean;
  allShifts?: ShiftWithRelations[];
}) {
  const theme = getShiftTheme(shift.shiftType.name);
  const duration = getDurationInHours(shift.start, shift.end);
  const concurrentShifts = getConcurrentShiftsFromList(shift, allShifts);

  let confirmedCount = shift._count?.placeholders ?? 0;
  let pendingCount = 0;

  for (const signup of shift.signups) {
    if (signup.status === "CONFIRMED") confirmedCount += 1;
    if (signup.status === "PENDING" || signup.status === "REGULAR_PENDING") pendingCount += 1;
  }

  const remaining = Math.max(0, shift.capacity - confirmedCount - pendingCount);
  const isFull = remaining === 0;

  const mySignup = currentUserId
    ? shift.signups.find(
        (s) => s.userId === currentUserId && s.status !== "CANCELED"
      )
    : undefined;

  const hasConflictingSignup = !mySignup && currentUserId
    ? allShifts.some((otherShift) => {
        if (otherShift.id === shift.id) return false;
        if (getShiftDateHelper(otherShift.start) !== getShiftDateHelper(shift.start)) return false;
        if (isAMShiftHelper(otherShift.start) !== isAMShiftHelper(shift.start)) return false;
        return otherShift.signups.some(
          (s) => s.userId === currentUserId && (s.status === "CONFIRMED" || s.status === "PENDING")
        );
      })
    : false;

  const friendSignups = shift.signups.filter(
    (signup) =>
      userFriendIds.includes(signup.userId) && signup.status === "CONFIRMED"
  );

  return (
    <Card
      data-testid={`shift-card-${shift.id}`}
      className={`group relative overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${theme.bgColor} h-full`}
    >
      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.fullGradient}`}
      />
      <CardContent className="p-6 h-full">
        <div className="flex flex-col h-full">
          <div className="space-y-4 flex-1">
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
                        variant={mySignup.status === "CONFIRMED" ? "default" : "secondary"}
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

            {shift.shiftType.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
                {shift.shiftType.description}
              </p>
            )}

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
                    {Math.min(confirmedCount + pendingCount, shift.capacity)}/{shift.capacity}
                    {confirmedCount + pendingCount > shift.capacity && (
                      <span className="text-orange-600 dark:text-orange-400 ml-1">
                        +{confirmedCount + pendingCount - shift.capacity}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {remaining > 0 ? (
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {remaining} spots left
                      </span>
                    ) : confirmedCount + pendingCount > shift.capacity ? (
                      <span className="text-orange-600 dark:text-orange-400 font-medium">
                        Over capacity
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

          </div>

          <div className="pt-4 mt-auto">
            {mySignup ? (
              <CancelSignupButton
                shiftId={shift.id}
                shiftName={shift.shiftType.name}
                className="w-full"
              />
            ) : session ? (
              hasConflictingSignup ? (
                <Button
                  disabled
                  data-testid="shift-signup-button-conflict"
                  className="w-full font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  variant="outline"
                >
                  Already signed up for this {isAMShiftHelper(shift.start) ? "AM" : "PM"} period
                </Button>
              ) : canSignUp ? (
                <ShiftSignupButton
                  isFull={isFull}
                  theme={theme}
                  shift={shift}
                  confirmedCount={confirmedCount}
                  currentUserId={currentUserId}
                  concurrentShifts={concurrentShifts}
                />
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
                <Link href="/login?callbackUrl=/shifts/details">
                  ✨ Sign Up Now
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ShiftDetailsContentProps {
  dateParam: string;
  selectedLocation?: string;
}

export async function ShiftDetailsContent({
  dateParam,
  selectedLocation,
}: ShiftDetailsContentProps) {
  const session = await getServerSession(authOptions);

  const { parseISOInNZT } = await import("@/lib/timezone");
  const selectedDate = parseISOInNZT(dateParam);

  // Get current user and their friends
  let currentUser = null;
  let userFriendIds: string[] = [];

  if (session?.user?.email) {
    currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (currentUser?.id) {
      const friendships = await prisma.friendship.findMany({
        where: {
          AND: [
            { OR: [{ userId: currentUser.id }, { friendId: currentUser.id }] },
            { status: "ACCEPTED" },
          ],
        },
        select: { userId: true, friendId: true },
      });

      userFriendIds = friendships.map((friendship) =>
        friendship.userId === currentUser!.id
          ? friendship.friendId
          : friendship.userId
      );
    }
  }

  // Check profile completion
  let canSignUpForShifts = true;
  let needsParentalConsent = false;
  if (currentUser?.id) {
    const profileStatus = await checkProfileCompletion(currentUser.id);
    canSignUpForShifts = profileStatus.canSignUpForShifts;
    needsParentalConsent = profileStatus.needsParentalConsent || false;
  }

  // Fetch shifts
  const startOfDayNZ = startOfDay(selectedDate);
  const endOfDayNZ = endOfDay(selectedDate);
  const startOfDayUTC = toUTC(startOfDayNZ);
  const endOfDayUTC = toUTC(endOfDayNZ);

  const allShifts = (await prisma.shift.findMany({
    where: {
      start: { gte: startOfDayUTC, lte: endOfDayUTC },
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
      _count: {
        select: { placeholders: true },
      },
    },
  })) as ShiftWithRelations[];

  const isAMShift = (shift: ShiftWithRelations) => {
    const hour = parseInt(formatInNZT(shift.start, "HH"));
    return hour < 16;
  };

  const shiftsByLocationAndTime = new Map<
    string,
    { AM: ShiftWithRelations[]; PM: ShiftWithRelations[] }
  >();
  for (const shift of allShifts) {
    const locationKey = shift.location || "TBD";
    const timeOfDay = isAMShift(shift) ? "AM" : "PM";
    if (!shiftsByLocationAndTime.has(locationKey)) {
      shiftsByLocationAndTime.set(locationKey, { AM: [], PM: [] });
    }
    shiftsByLocationAndTime.get(locationKey)![timeOfDay].push(shift);
  }

  const sortedLocations = Array.from(shiftsByLocationAndTime.keys()).sort();

  if (allShifts.length === 0) {
    return (
      <div className="text-center py-20" data-testid="empty-state">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Calendar className="w-10 h-10 text-primary/60" />
        </div>
        <h3 className="text-2xl font-semibold mb-3" data-testid="empty-state-title">
          No shifts scheduled
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto" data-testid="empty-state-description">
          No shifts are scheduled for{" "}
          {formatInNZT(selectedDate, "MMMM d, yyyy")}
          {selectedLocation ? ` in ${selectedLocation}` : ""}.
        </p>
        <div className="mt-6 space-x-4">
          <Button asChild variant="outline">
            <Link href="/shifts">View Other Dates</Link>
          </Button>
          {selectedLocation && (
            <Button asChild>
              <Link href={`/shifts/details?date=${dateParam}`}>
                View All Locations
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
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
              </div>
            )}

            {hasAMShifts && (
              <div className="space-y-4" data-testid={`shifts-am-section-${locationKey.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-lg">
                    ☀️
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Day Shifts</h3>
                    <p className="text-sm text-muted-foreground">
                      {locationTimeShifts.AM.length} shift
                      {locationTimeShifts.AM.length !== 1 ? "s" : ""} available (before 4pm)
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
                      allShifts={allShifts}
                    />
                  ))}
                </div>
              </div>
            )}

            {hasPMShifts && (
              <div className="space-y-4" data-testid={`shifts-pm-section-${locationKey.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-lg">
                    🌙
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Evening Shifts</h3>
                    <p className="text-sm text-muted-foreground">
                      {locationTimeShifts.PM.length} shift
                      {locationTimeShifts.PM.length !== 1 ? "s" : ""} available (4pm onwards)
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
                      allShifts={allShifts}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

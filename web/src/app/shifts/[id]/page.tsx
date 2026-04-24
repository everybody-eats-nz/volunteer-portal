import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { notFound } from "next/navigation";
import { getConcurrentShifts } from "@/lib/concurrent-shifts";
import { isAMShift, getShiftDate } from "@/lib/concurrent-shifts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarList } from "@/components/ui/avatar-list";
import { CancelSignupButton } from "../mine/cancel-signup-button";
import { PageContainer } from "@/components/page-container";
import {
  Clock,
  MapPin,
  UserCheck,
  ArrowLeft,
  AlertCircle,
  CalendarPlus,
} from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProfileCompletionBannerServer } from "@/components/profile-completion-banner-server";
import { generateCalendarUrls } from "@/lib/calendar-utils";
import { LOCATION_ADDRESSES, type Location } from "@/lib/locations";
import { ShiftSignupButton } from "@/components/shift-signup-button";
import { getShiftTheme } from "@/lib/shift-themes";
import { Suspense } from "react";

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  // Fetch shift details — must come first as everything depends on it
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      shiftType: true,
      signups: {
        where: {
          status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              friendVisibility: true,
              profilePhotoUrl: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 10,
      },
      _count: {
        select: {
          signups: {
            where: {
              status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
            },
          },
          placeholders: true,
        },
      },
    },
  });

  if (!shift) {
    notFound();
  }

  // Parallelize all remaining queries
  const [friendships, userSignup, currentUser, concurrentShifts] =
    await Promise.all([
      // Friends
      userId
        ? prisma.friendship.findMany({
            where: {
              OR: [
                { userId, status: "ACCEPTED" },
                { friendId: userId, status: "ACCEPTED" },
              ],
            },
            select: { userId: true, friendId: true },
          })
        : Promise.resolve([]),

      // User's signup for this shift
      userId
        ? prisma.signup.findFirst({
            where: {
              userId,
              shiftId: id,
              status: { in: ["CONFIRMED", "WAITLISTED", "PENDING", "REGULAR_PENDING"] },
            },
          })
        : Promise.resolve(null),

      // User profile for consent/completion checks
      userId
        ? prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              requiresParentalConsent: true,
              parentalConsentReceived: true,
              phone: true,
              dateOfBirth: true,
              emergencyContactName: true,
              emergencyContactPhone: true,
              volunteerAgreementAccepted: true,
              healthSafetyPolicyAccepted: true,
            },
          })
        : Promise.resolve(null),

      // Concurrent shifts for backup options
      getConcurrentShifts(id),
    ]);

  const userFriendIds = friendships.flatMap((f) =>
    f.userId === userId ? [f.friendId] : [f.userId]
  );

  const friendSignups = shift.signups.filter(
    (signup) =>
      userId &&
      signup.user.id !== userId &&
      userFriendIds.includes(signup.user.id)
  );

  const otherVolunteersCount =
    shift._count.signups -
    friendSignups.length -
    (userId && shift.signups.some((s) => s.user.id === userId) ? 1 : 0);

  const isPastShift = new Date(shift.end) < new Date();

  const confirmedCount = shift._count.signups + shift._count.placeholders;
  const isWaitlist = confirmedCount >= shift.capacity;
  const spotsRemaining = Math.max(0, shift.capacity - confirmedCount);
  const theme = getShiftTheme(shift.shiftType.name);

  const needsParentalConsent =
    currentUser &&
    currentUser.requiresParentalConsent &&
    !currentUser.parentalConsentReceived;

  const missingFields = [];
  if (currentUser) {
    if (!currentUser.phone) missingFields.push("Mobile number");
    if (!currentUser.dateOfBirth) missingFields.push("Date of birth");
    if (!currentUser.emergencyContactName)
      missingFields.push("Emergency contact name");
    if (!currentUser.emergencyContactPhone)
      missingFields.push("Emergency contact phone");
    if (!currentUser.volunteerAgreementAccepted)
      missingFields.push("Volunteer agreement");
    if (!currentUser.healthSafetyPolicyAccepted)
      missingFields.push("Health & safety policy");
  }
  const hasIncompleteProfile = missingFields.length > 0;

  // Check conflicting signup (only if user hasn't signed up for this shift)
  let hasConflictingSignup = false;
  if (userId && !userSignup) {
    const shiftDate = getShiftDate(shift.start);
    const shiftIsAM = isAMShift(shift.start);
    const existingSignups = await prisma.signup.findMany({
      where: {
        userId,
        status: { in: ["CONFIRMED", "PENDING"] },
        shiftId: { not: id },
      },
      include: { shift: { select: { start: true } } },
    });
    hasConflictingSignup = existingSignups.some((s) => {
      return getShiftDate(s.shift.start) === shiftDate && isAMShift(s.shift.start) === shiftIsAM;
    });
  }

  const isLoggedOut = !session;
  const isAlreadySignedUp = !!userSignup;
  const canSignUp =
    !!session &&
    !isPastShift &&
    !isAlreadySignedUp &&
    !needsParentalConsent &&
    !hasIncompleteProfile &&
    !hasConflictingSignup;

  const shiftDate = formatInNZT(new Date(shift.start), "EEEE, MMMM d, yyyy");
  const shiftTime = `${formatInNZT(
    new Date(shift.start),
    "h:mm a"
  )} - ${formatInNZT(new Date(shift.end), "h:mm a")}`;
  const duration = Math.round(
    (new Date(shift.end).getTime() - new Date(shift.start).getTime()) /
      (1000 * 60 * 60)
  );

  return (
    <PageContainer>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`/shifts/details?date=${formatInNZT(
              new Date(shift.start),
              "yyyy-MM-dd"
            )}${
              shift.location
                ? `&location=${encodeURIComponent(shift.location)}`
                : ""
            }`}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shifts
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div
          className={`p-3 rounded-xl bg-gradient-to-br ${theme.gradient} shadow-lg flex items-center justify-center text-white text-2xl`}
        >
          {theme.emoji}
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {shift.shiftType.name}
          </h1>
          {shift.shiftType.description && (
            <p className="text-muted-foreground mt-1">
              {shift.shiftType.description}
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-3">
              <CardTitle className="text-2xl">{shiftDate}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {shiftTime}
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {shift.location || "TBD"}
                </Badge>
              </div>
            </div>
            <div className="flex-shrink-0">
              {isPastShift ? (
                <Badge variant="outline">Past Shift</Badge>
              ) : isWaitlist ? (
                <Badge
                  variant="outline"
                  className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50"
                >
                  Waitlist Only
                </Badge>
              ) : (
                <Badge className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50">
                  {spotsRemaining} spots left
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isAlreadySignedUp && !isPastShift && (
            <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800/50">
              <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-700 dark:text-green-300">
                You&apos;re signed up for this shift!
              </span>
            </div>
          )}

          {!isPastShift && !userSignup && spotsRemaining > 3 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Volunteers needed!</strong> We still need{" "}
                {spotsRemaining} more volunteers for this shift.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {isLoggedOut && (
              <div className="w-full">
                <Alert>
                  <AlertDescription>
                    Please{" "}
                    <Link
                      href={`/login?callbackUrl=/shifts/${id}`}
                      className="font-medium underline"
                    >
                      sign in
                    </Link>{" "}
                    to sign up for this shift.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {isPastShift && !isLoggedOut && (
              <Button disabled variant="secondary" className="w-full sm:w-auto">
                Shift has ended
              </Button>
            )}

            {isAlreadySignedUp && !isPastShift && (
              <CancelSignupButton
                shiftId={id}
                shiftName={shift.shiftType.name}
              />
            )}

            {!canSignUp &&
              !isLoggedOut &&
              !isPastShift &&
              !isAlreadySignedUp &&
              hasConflictingSignup && (
                <Button disabled variant="secondary" className="w-full sm:w-auto">
                  Already signed up for this {isAMShift(shift.start) ? "AM" : "PM"} period
                </Button>
              )}

            {!canSignUp &&
              !isLoggedOut &&
              !isPastShift &&
              !isAlreadySignedUp &&
              !hasConflictingSignup &&
              needsParentalConsent && (
                <div className="w-full space-y-2">
                  <Button disabled variant="secondary" className="w-full sm:w-auto">
                    Parental Consent Required
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Please download the consent form from your dashboard, have
                    your parent/guardian sign it, and email it to{" "}
                    <strong>volunteer@everybodyeats.nz</strong> for approval.
                  </p>
                </div>
              )}

            {!canSignUp &&
              !isLoggedOut &&
              !isPastShift &&
              !isAlreadySignedUp &&
              !hasConflictingSignup &&
              !needsParentalConsent &&
              hasIncompleteProfile && (
                <div className="w-full space-y-2">
                  <Button disabled variant="secondary" className="w-full sm:w-auto">
                    Complete Profile Required
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Please complete your profile to sign up for shifts.
                  </p>
                </div>
              )}

            {canSignUp && (
              <ShiftSignupButton
                theme={getShiftTheme(shift.shiftType.name)}
                isFull={isWaitlist}
                shift={shift}
                confirmedCount={confirmedCount}
                currentUserId={userId}
                concurrentShifts={concurrentShifts}
              />
            )}
          </div>

          {session && (needsParentalConsent || hasIncompleteProfile) && (
            <div className="py-2">
              <Suspense fallback={null}>
                <ProfileCompletionBannerServer />
              </Suspense>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium">{duration} hours</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Capacity</p>
              <p className="font-medium">
                {confirmedCount} of {shift.capacity} volunteers
              </p>
            </div>
          </div>

          {shift.location && (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{shift.location}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `Everybody Eats ${
                        LOCATION_ADDRESSES[shift.location as Location] ||
                        shift.location
                      }`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {LOCATION_ADDRESSES[shift.location as Location] ||
                      shift.location}
                  </a>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `Everybody Eats ${
                        LOCATION_ADDRESSES[shift.location as Location] ||
                        shift.location
                      }`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get Directions
                  </a>
                </Button>
              </div>
              <div className="rounded-lg overflow-hidden border h-48">
                <iframe
                  title="Shift location map"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    `Everybody Eats ${
                      LOCATION_ADDRESSES[shift.location as Location] ||
                      shift.location
                    }`
                  )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                />
              </div>
            </div>
          )}

          {(friendSignups.length > 0 || otherVolunteersCount > 0) && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {friendSignups.length > 0
                  ? `${friendSignups.length} friend${
                      friendSignups.length !== 1 ? "s" : ""
                    } joining`
                  : "Current Volunteers"}
              </h3>
              <AvatarList
                users={friendSignups.map((signup) => ({
                  id: signup.user.id,
                  name:
                    signup.user.name ||
                    `${signup.user.firstName} ${signup.user.lastName}`.trim() ||
                    "Volunteer",
                  firstName: signup.user.firstName,
                  lastName: signup.user.lastName,
                  email: signup.user.email,
                  profilePhotoUrl: signup.user.profilePhotoUrl,
                }))}
                maxDisplay={8}
                totalCount={friendSignups.length + otherVolunteersCount}
              />
            </div>
          )}

          {!isPastShift && (
            <div className="pt-2 border-t">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Add to Calendar
              </div>
              <div className="flex gap-2 flex-wrap">
                {(() => {
                  const urls = generateCalendarUrls(shift);
                  return (
                    <>
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <a href={urls.google} target="_blank" rel="noopener noreferrer">
                          <CalendarPlus className="h-3.5 w-3.5" />
                          Google
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <a href={urls.outlook} target="_blank" rel="noopener noreferrer">
                          <CalendarPlus className="h-3.5 w-3.5" />
                          Outlook
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <a href={urls.ics} download={`shift-${shift.id}.ics`}>
                          <CalendarPlus className="h-3.5 w-3.5" />
                          .ics
                        </a>
                      </Button>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvatarList } from "@/components/ui/avatar-list";
import { ShiftSignupDialog } from "@/components/shift-signup-dialog";
import { CancelSignupButton } from "../mine/cancel-signup-button";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import {
  Clock,
  MapPin,
  Users,
  UserCheck,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DashboardProfileCompletionBanner } from "@/components/dashboard-profile-completion-banner";

// Shift type theming configuration (same as shifts page)
const SHIFT_THEMES = {
  Dishwasher: {
    gradient: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-200 dark:border-blue-800/50",
    textColor: "text-blue-700 dark:text-blue-300",
    emoji: "🧽",
  },
  "FOH Set-Up & Service": {
    gradient: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    borderColor: "border-purple-200 dark:border-purple-800/50",
    textColor: "text-purple-700 dark:text-purple-300",
    emoji: "✨",
  },
  "Front of House": {
    gradient: "from-green-500 to-emerald-500",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    borderColor: "border-green-200 dark:border-green-800/50",
    textColor: "text-green-700 dark:text-green-300",
    emoji: "🌟",
  },
  "Kitchen Prep": {
    gradient: "from-orange-500 to-amber-500",
    bgColor: "bg-orange-50 dark:bg-orange-950/20",
    borderColor: "border-orange-200 dark:border-orange-800/50",
    textColor: "text-orange-700 dark:text-orange-300",
    emoji: "🔪",
  },
  "Kitchen Prep & Service": {
    gradient: "from-red-500 to-pink-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    borderColor: "border-red-200 dark:border-red-800/50",
    textColor: "text-red-700 dark:text-red-300",
    emoji: "🍳",
  },
  "Kitchen Service & Pack Down": {
    gradient: "from-indigo-500 to-purple-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
    borderColor: "border-indigo-200 dark:border-indigo-800/50",
    textColor: "text-indigo-700 dark:text-indigo-300",
    emoji: "📦",
  },
} as const;

const DEFAULT_THEME = {
  gradient: "from-gray-500 to-slate-500",
  bgColor: "bg-gray-50 dark:bg-gray-950/20",
  borderColor: "border-gray-200 dark:border-gray-800/50",
  textColor: "text-gray-700 dark:text-gray-300",
  emoji: "🍽️",
};

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  
  // Allow viewing without login, but signup requires authentication
  const userId = session?.user?.id;

  // Fetch shift details with all related data
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      shiftType: true,
      signups: {
        where: {
          status: {
            in: ["CONFIRMED", "REGULAR_PENDING"],
          },
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
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 10,
      },
      _count: {
        select: {
          signups: {
            where: {
              status: {
                in: ["CONFIRMED", "REGULAR_PENDING"],
              },
            },
          },
        },
      },
    },
  });

  if (!shift) {
    notFound();
  }

  // Get current user's friends if they're logged in
  let userFriendIds: string[] = [];
  if (userId) {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: userId, status: "ACCEPTED" },
          { friendId: userId, status: "ACCEPTED" }
        ]
      },
      select: {
        userId: true,
        friendId: true,
      }
    });
    
    // Extract friend IDs (excluding current user)
    userFriendIds = friendships.flatMap(f => 
      f.userId === userId ? [f.friendId] : [f.userId]
    );
  }

  // Filter signups based on privacy settings
  const visibleSignups = shift.signups.filter(signup => {
    // Always show current user's own signup
    if (userId && signup.user.id === userId) {
      return true;
    }
    
    // If not logged in, don't show any volunteers
    if (!userId) {
      return false;
    }
    
    // Check user's privacy settings
    const { friendVisibility } = signup.user;
    
    switch (friendVisibility) {
      case "PUBLIC":
        return true;
      case "FRIENDS_ONLY":
        return userFriendIds.includes(signup.user.id);
      case "PRIVATE":
        return false;
      default:
        return false;
    }
  });

  // Check if the shift is in the past
  const isPastShift = new Date(shift.end) < new Date();

  // Check if user is already signed up (if logged in) and get parental consent info
  let userSignup = null;
  let currentUser = null;
  if (userId) {
    userSignup = await prisma.signup.findFirst({
      where: {
        userId: userId,
        shiftId: id,
        status: {
          in: ["CONFIRMED", "WAITLISTED", "PENDING", "REGULAR_PENDING"],
        },
      },
    });

    // Get user info including parental consent status
    currentUser = await prisma.user.findUnique({
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
    });
  }

  const confirmedCount = shift._count.signups;
  const isWaitlist = confirmedCount >= shift.capacity;
  const spotsRemaining = Math.max(0, shift.capacity - confirmedCount);
  const theme = SHIFT_THEMES[shift.shiftType.name as keyof typeof SHIFT_THEMES] || DEFAULT_THEME;

  // Check if user needs parental consent approval
  const needsParentalConsent = currentUser && 
    currentUser.requiresParentalConsent && 
    !currentUser.parentalConsentReceived;

  // Check if profile is incomplete
  const missingFields = [];
  if (currentUser) {
    if (!currentUser.phone) missingFields.push("Mobile number");
    if (!currentUser.dateOfBirth) missingFields.push("Date of birth");
    if (!currentUser.emergencyContactName) missingFields.push("Emergency contact name");
    if (!currentUser.emergencyContactPhone) missingFields.push("Emergency contact phone");
    if (!currentUser.volunteerAgreementAccepted) missingFields.push("Volunteer agreement");
    if (!currentUser.healthSafetyPolicyAccepted) missingFields.push("Health & safety policy");
  }

  const hasIncompleteProfile = missingFields.length > 0;

  // Format date and time
  const shiftDate = format(new Date(shift.start), "EEEE, MMMM d, yyyy");
  const shiftTime = `${format(new Date(shift.start), "h:mm a")} - ${format(
    new Date(shift.end),
    "h:mm a"
  )}`;
  const duration = Math.round(
    (new Date(shift.end).getTime() - new Date(shift.start).getTime()) /
      (1000 * 60 * 60)
  );

  return (
    <PageContainer>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/shifts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Shifts
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`${theme.emoji} ${shift.shiftType.name}`}
        description={shift.shiftType.description || undefined}
      />

      {/* Main Shift Card */}
      <Card className={`border-2 ${theme.borderColor} ${theme.bgColor}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">
                {shiftDate}
              </CardTitle>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {shiftTime}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <MapPin className="h-3 w-3" />
                  {shift.location || "TBD"}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {confirmedCount}/{shift.capacity} volunteers
                </Badge>
              </div>
            </div>
            
            {/* Status Badge */}
            <div className="text-right">
              {isPastShift ? (
                <Badge variant="secondary">Past Shift</Badge>
              ) : isWaitlist ? (
                <Badge variant="secondary">Waitlist Only</Badge>
              ) : (
                <Badge variant="default">{spotsRemaining} spots left</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Shortage Alert - shown if spots need filling */}
          {!isPastShift && spotsRemaining > 3 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Volunteers needed!</strong> We still need {spotsRemaining} more volunteers for this shift.
              </AlertDescription>
            </Alert>
          )}

          {/* Shift Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium">{duration} hours</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="font-medium">{shift.location || "To be determined"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Capacity</p>
              <p className="font-medium">
                {confirmedCount} of {shift.capacity} volunteers
              </p>
            </div>
          </div>

          {/* Current Volunteers */}
          {visibleSignups.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Current Volunteers
              </h3>
              <AvatarList
                users={visibleSignups.map((signup) => ({
                  id: signup.user.id,
                  name:
                    signup.user.name ||
                    `${signup.user.firstName} ${signup.user.lastName}`.trim() ||
                    "Volunteer",
                  firstName: signup.user.firstName,
                  lastName: signup.user.lastName,
                  email: signup.user.email,
                  profilePhotoUrl: null, // No profile photo in User model
                }))}
                maxDisplay={8}
              />
            </div>
          )}

          {/* Profile Completion / Parental Consent Banner */}
          {session && (needsParentalConsent || hasIncompleteProfile) && (
            <div className="py-2">
              <DashboardProfileCompletionBanner />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {!session ? (
              // Not logged in - show login prompt
              <div className="w-full">
                <Alert>
                  <AlertDescription>
                    Please <Link href={`/login?callbackUrl=/shifts/${id}`} className="font-medium underline">sign in</Link> to sign up for this shift.
                  </AlertDescription>
                </Alert>
              </div>
            ) : isPastShift ? (
              // Shift is in the past
              <Button disabled variant="secondary" className="w-full sm:w-auto">
                Shift has ended
              </Button>
            ) : userSignup ? (
              // Already signed up - show cancel button
              <>
                <Badge variant="default" className="px-4 py-2 gap-1">
                  <UserCheck className="h-4 w-4" />
                  You&apos;re signed up!
                </Badge>
                <CancelSignupButton
                  shiftId={id}
                  shiftName={shift.shiftType.name}
                />
              </>
            ) : needsParentalConsent ? (
              // Needs parental consent - show disabled button with message
              <div className="w-full space-y-2">
                <Button disabled variant="secondary" className="w-full sm:w-auto">
                  Parental Consent Required
                </Button>
                <p className="text-sm text-muted-foreground">
                  Please download the consent form from your dashboard, have your parent/guardian sign it, and email it to <strong>volunteers@everybodyeats.nz</strong> for approval.
                </p>
              </div>
            ) : hasIncompleteProfile ? (
              // Profile incomplete - show disabled button with message
              <div className="w-full space-y-2">
                <Button disabled variant="secondary" className="w-full sm:w-auto">
                  Complete Profile Required
                </Button>
                <p className="text-sm text-muted-foreground">
                  Please complete your profile to sign up for shifts.
                </p>
              </div>
            ) : (
              // Not signed up - show signup options
              <>
                <ShiftSignupDialog
                  shift={shift}
                  confirmedCount={confirmedCount}
                  isWaitlist={isWaitlist}
                  currentUserId={userId}
                >
                  <Button
                    variant={isWaitlist ? "secondary" : "default"}
                    className="w-full sm:w-auto"
                  >
                    {isWaitlist ? "Join Waitlist" : "Sign Up"}
                  </Button>
                </ShiftSignupDialog>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      {shift.shiftType.description && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>About this shift</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{shift.shiftType.description}</p>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
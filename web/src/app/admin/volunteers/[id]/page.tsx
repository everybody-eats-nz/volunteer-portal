import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { calculateAge } from "@/lib/utils";
import { formatInNZT } from "@/lib/timezone";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Cake,
  Clock,
  MapPin,
  Mail,
  User,
  Heart,
  Shield,
  Filter,
  ChevronLeft,
  Star,
  PauseCircle,
  CheckCircle,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { safeParseAvailability } from "@/lib/parse-availability";
import { VolunteerGradeToggle } from "@/components/volunteer-grade-toggle";
import { VolunteerGradeBadge } from "@/components/volunteer-grade-badge";
import { UserRoleToggle } from "@/components/user-role-toggle";
import { AdminNotesManager } from "@/components/admin-notes-manager";
import { UserCustomLabelsManager } from "@/components/user-custom-labels-manager";
import { type VolunteerGrade } from "@/generated/client";
import { LOCATIONS, LocationOption } from "@/lib/locations";
import { ImpersonateUserButton } from "@/components/impersonate-user-button";
import { AdminContactInfoSection } from "@/components/admin-contact-info-section";
import { GenerateAchievementsButton } from "@/components/generate-achievements-button";
import { hearAboutUsOptions } from "@/lib/form-constants";

interface AdminVolunteerPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminVolunteerPage({
  params,
  searchParams,
}: AdminVolunteerPageProps) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const searchParamsResolved = await searchParams;

  // Get location filter from search params
  const rawLocation = Array.isArray(searchParamsResolved.location)
    ? searchParamsResolved.location[0]
    : searchParamsResolved.location;
  const selectedLocation: LocationOption | undefined = LOCATIONS.includes(
    (rawLocation as LocationOption) ?? ("" as LocationOption)
  )
    ? (rawLocation as LocationOption)
    : undefined;

  // Fetch volunteer profile data
  const volunteer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      pronouns: true,
      profilePhotoUrl: true,
      emergencyContactName: true,
      emergencyContactRelationship: true,
      emergencyContactPhone: true,
      medicalConditions: true,
      willingToProvideReference: true,
      howDidYouHearAboutUs: true,
      availableDays: true,
      availableLocations: true,
      emailNewsletterSubscription: true,
      notificationPreference: true,
      volunteerAgreementAccepted: true,
      healthSafetyPolicyAccepted: true,
      role: true,
      volunteerGrade: true,
      createdAt: true,
      regularVolunteer: {
        include: {
          shiftType: true,
          autoSignups: {
            take: 5,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              signup: {
                include: {
                  shift: true,
                },
              },
            },
          },
        },
      },
      signups: {
        include: {
          shift: {
            include: {
              shiftType: true,
            },
          },
        },
        orderBy: {
          shift: {
            start: "desc",
          },
        },
        where: {
          // Exclude canceled signups that were never confirmed (PENDING cancellations)
          NOT: {
            AND: [
              { status: "CANCELED" },
              { OR: [{ previousStatus: null }, { previousStatus: "PENDING" }] },
            ],
          },
          // Apply location filter if specified
          ...(selectedLocation
            ? { shift: { location: selectedLocation } }
            : {}),
        },
      },
      customLabels: {
        include: {
          label: true,
        },
        orderBy: {
          assignedAt: "desc",
        },
      },
    },
  });

  if (!volunteer) {
    notFound();
  }

  const volunteerInitials = volunteer.name
    ? volunteer.name
        .split(" ")
        .map((name: string) => name.charAt(0))
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "V";

  const availableDays = safeParseAvailability(volunteer.availableDays);
  const availableLocations = safeParseAvailability(
    volunteer.availableLocations
  );

  // Calculate shift statistics (all shifts, not filtered)
  const allSignups = await prisma.signup.findMany({
    where: { userId: id },
    include: {
      shift: {
        include: {
          shiftType: true,
        },
      },
    },
  });

  const now = new Date();
  const totalShifts = allSignups.length;
  const upcomingShifts = allSignups.filter(
    (signup: (typeof allSignups)[0]) =>
      signup.shift.start >= now && signup.status === "CONFIRMED"
  ).length;
  const completedShifts = allSignups.filter(
    (signup: (typeof allSignups)[0]) =>
      signup.shift.start < now && signup.status === "CONFIRMED"
  ).length;

  // Track confirmed cancellations (only matters for reporting)
  const confirmedCancellations = volunteer.signups.filter(
    (signup: (typeof volunteer.signups)[0]) =>
      signup.status === "CANCELED" &&
      signup.canceledAt &&
      signup.previousStatus === "CONFIRMED"
  ).length;

  // Track no-shows (manually set by admin)
  const noShows = volunteer.signups.filter(
    (signup: (typeof volunteer.signups)[0]) => signup.status === "NO_SHOW"
  ).length;

  const dayLabels: Record<string, string> = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };

  const locationLabels: Record<string, string> = {
    wellington: "Wellington",
    "glen-innes": "Glen Innes",
    onehunga: "Onehunga",
    mobile: "Mobile/Outreach",
  };

  // Convert hearAboutUsOptions to a label mapping
  const hearAboutLabels = Object.fromEntries(
    hearAboutUsOptions.map((option) => [option.value, option.label])
  );

  return (
    <AdminPageWrapper
      title="Volunteer Profile"
      description="Comprehensive view of volunteer information and activity"
      actions={
        <Button
          asChild
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="back-to-shifts-button"
        >
          <Link href="/admin/shifts">
            <ChevronLeft className="h-4 w-4" />
            Back to Shifts
          </Link>
        </Button>
      }
    >
      <PageContainer
        testid="admin-volunteer-profile-page"
        className="bg-background"
      >
        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          data-testid="volunteer-profile-layout"
        >
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Basic Information */}
            <Card data-testid="basic-information-card">
              <CardContent className="text-center">
                <div className="flex justify-center mb-4">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                    <AvatarImage
                      src={volunteer.profilePhotoUrl || ""}
                      alt={volunteer.name || "Volunteer"}
                    />
                    <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                      {volunteerInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <h2
                  className="text-2xl font-bold mb-2"
                  data-testid="volunteer-name"
                >
                  {volunteer.name || "Volunteer"}
                </h2>

                <div
                  className="flex items-center justify-center gap-2 text-muted-foreground mb-4"
                  data-testid="volunteer-email"
                >
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">{volunteer.email}</span>
                </div>

                {volunteer.pronouns && (
                  <p className="text-sm text-muted-foreground mb-3">
                    Pronouns: {volunteer.pronouns}
                  </p>
                )}

                {volunteer.dateOfBirth && (
                  <Badge
                    variant="secondary"
                    className="mb-4"
                    data-testid="volunteer-age"
                  >
                    <Cake className="h-3 w-3 mr-1" />
                    {calculateAge(volunteer.dateOfBirth)} yrs
                  </Badge>
                )}

                <div className="flex flex-wrap gap-2 justify-center mb-6">
                  <Badge variant="default" data-testid="user-role">
                    <User className="h-3 w-3 mr-1" />
                    {volunteer.role === "ADMIN" ? "Administrator" : "Volunteer"}
                  </Badge>
                  {volunteer.role === "VOLUNTEER" &&
                    volunteer.volunteerGrade && (
                      <VolunteerGradeBadge
                        grade={volunteer.volunteerGrade as VolunteerGrade}
                        size="default"
                      />
                    )}
                  {volunteer.regularVolunteer && (
                    <Badge
                      variant="outline"
                      className={
                        volunteer.regularVolunteer.isActive &&
                        !volunteer.regularVolunteer.isPausedByUser
                          ? "border-yellow-500/20 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20"
                          : "border-gray-500/20 text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/20"
                      }
                    >
                      <Star className="h-3 w-3 mr-1" />
                      {volunteer.regularVolunteer.isActive &&
                      !volunteer.regularVolunteer.isPausedByUser
                        ? "Active Regular"
                        : volunteer.regularVolunteer.isPausedByUser
                        ? "Regular (Paused)"
                        : "Regular (Inactive)"}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="border-green-500/20 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20"
                  >
                    <Heart className="h-3 w-3 mr-1" />
                    Active Member
                  </Badge>
                  {volunteer.volunteerAgreementAccepted && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/20 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      Agreement Signed
                    </Badge>
                  )}
                </div>

                {/* Quick Stats */}
                <div
                  className="grid grid-cols-3 gap-4 pt-4 border-t"
                  data-testid="volunteer-stats"
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold">{totalShifts}</div>
                    <div className="text-xs text-muted-foreground">
                      Total Shifts
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {upcomingShifts}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Upcoming
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {completedShifts}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Completed
                    </div>
                  </div>
                  {confirmedCancellations > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {confirmedCancellations}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Canceled
                      </div>
                    </div>
                  )}
                  {noShows > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {noShows}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        No-shows
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Admin Actions */}
            <Card data-testid="admin-actions-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Admin Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Impersonate User
                  </label>
                  <div>
                    <ImpersonateUserButton
                      userId={volunteer.id}
                      userName={volunteer.name || volunteer.email}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    View the application as this user and perform actions on
                    their behalf
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">User Role</label>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={
                        volunteer.role === "ADMIN"
                          ? "bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 font-medium shadow-sm"
                          : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-medium shadow-sm"
                      }
                    >
                      {volunteer.role === "ADMIN" ? (
                        <>
                          <Shield className="h-3 w-3 mr-1" />
                          Administrator
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3 mr-1" />
                          Volunteer
                        </>
                      )}
                    </Badge>
                    <UserRoleToggle
                      userId={volunteer.id}
                      currentRole={volunteer.role}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {volunteer.role === "ADMIN"
                      ? "Full access to manage users, shifts, and system settings"
                      : "Can sign up for shifts and manage their own profile"}
                  </p>
                </div>

                {volunteer.role === "VOLUNTEER" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Volunteer Grade
                    </label>
                    <div className="flex items-center gap-3">
                      <VolunteerGradeBadge
                        grade={volunteer.volunteerGrade}
                        size="default"
                      />
                      <VolunteerGradeToggle
                        userId={volunteer.id}
                        currentGrade={volunteer.volunteerGrade}
                        userRole={volunteer.role}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {volunteer.volunteerGrade === "GREEN" &&
                        "Standard volunteer with basic access"}
                      {volunteer.volunteerGrade === "YELLOW" &&
                        "Experienced volunteer with additional privileges"}
                      {volunteer.volunteerGrade === "PINK" &&
                        "Shift leader with team management capabilities"}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Achievements</label>
                  <div>
                    <GenerateAchievementsButton
                      userId={volunteer.id}
                      userName={volunteer.name || volunteer.email}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Manually trigger achievement calculation for this user based
                    on their current progress
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Admin Notes */}
            <Card data-testid="admin-notes-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  Admin Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AdminNotesManager volunteerId={volunteer.id} />
              </CardContent>
            </Card>

            {/* Custom Labels */}
            <UserCustomLabelsManager
              userId={volunteer.id}
              currentLabels={volunteer.customLabels}
            />

            {/* Contact Information */}
            <AdminContactInfoSection
              volunteerId={volunteer.id}
              email={volunteer.email}
              phone={volunteer.phone}
              dateOfBirth={volunteer.dateOfBirth}
            />

            {/* Emergency Contact */}
            <Card data-testid="emergency-contact-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500 dark:text-red-400" />
                  Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <p className="text-sm text-muted-foreground">
                    {volunteer.emergencyContactName || "Not provided"}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Relationship</label>
                  <p className="text-sm text-muted-foreground">
                    {volunteer.emergencyContactRelationship || "Not provided"}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <p className="text-sm text-muted-foreground">
                    {volunteer.emergencyContactPhone || "Not provided"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Detailed Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Regular Volunteer Configuration */}
            {volunteer.regularVolunteer && (
              <Card data-testid="regular-volunteer-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    Regular Volunteer Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 dark:bg-muted/30 rounded-lg space-y-1">
                      <label className="text-sm font-medium">Shift Type</label>
                      <p className="text-sm text-muted-foreground">
                        {volunteer.regularVolunteer.shiftType.name}
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 dark:bg-muted/30 rounded-lg space-y-1">
                      <label className="text-sm font-medium">Location</label>
                      <p className="text-sm text-muted-foreground">
                        {volunteer.regularVolunteer.location}
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 dark:bg-muted/30 rounded-lg space-y-1">
                      <label className="text-sm font-medium">Frequency</label>
                      <p className="text-sm text-muted-foreground">
                        {volunteer.regularVolunteer.frequency === "WEEKLY"
                          ? "Weekly"
                          : volunteer.regularVolunteer.frequency ===
                            "FORTNIGHTLY"
                          ? "Fortnightly"
                          : volunteer.regularVolunteer.frequency === "MONTHLY"
                          ? "Monthly"
                          : volunteer.regularVolunteer.frequency}
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 dark:bg-muted/30 rounded-lg space-y-1">
                      <label className="text-sm font-medium">Status</label>
                      <div className="flex items-center gap-2">
                        {volunteer.regularVolunteer.isActive ? (
                          volunteer.regularVolunteer.isPausedByUser ? (
                            <>
                              <PauseCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                              <span className="text-sm text-yellow-600 dark:text-yellow-400">
                                Paused
                              </span>
                              {volunteer.regularVolunteer.pausedUntil && (
                                <span className="text-xs text-muted-foreground">
                                  until{" "}
                                  {format(
                                    volunteer.regularVolunteer.pausedUntil,
                                    "dd MMM yyyy"
                                  )}
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                              <span className="text-sm text-green-600 dark:text-green-400">
                                Active
                              </span>
                            </>
                          )
                        ) : (
                          <>
                            <PauseCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Inactive
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Available Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {volunteer.regularVolunteer.availableDays.map(
                        (day: string) => (
                          <Badge
                            key={day}
                            variant="outline"
                            className="border-yellow-500/20 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20"
                          >
                            {day}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>

                  {volunteer.regularVolunteer.notes && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Admin Notes</label>
                      <p className="text-sm text-muted-foreground bg-muted/50 dark:bg-muted/30 p-3 rounded-lg">
                        {volunteer.regularVolunteer.notes}
                      </p>
                    </div>
                  )}

                  {volunteer.regularVolunteer.autoSignups.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Recent Auto-Signups
                      </label>
                      <div className="space-y-2">
                        {volunteer.regularVolunteer.autoSignups.map(
                          (autoSignup) => (
                            <div
                              key={autoSignup.id}
                              className="text-sm p-2 bg-muted/30 dark:bg-muted/20 rounded flex items-center justify-between"
                            >
                              <span>
                                {formatInNZT(
                                  autoSignup.signup.shift.start,
                                  "EEE dd MMM yyyy, h:mma"
                                )}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {autoSignup.signup.status === "REGULAR_PENDING"
                                  ? "Auto-Applied"
                                  : autoSignup.signup.status}
                              </Badge>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Availability & Preferences */}
            <Card data-testid="availability-preferences-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Availability & Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium">Available Days</label>
                  <div className="flex flex-wrap gap-2">
                    {availableDays.length > 0 ? (
                      availableDays.map((day: string) => (
                        <Badge
                          key={day}
                          variant="outline"
                          className="border-blue-500/20 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20"
                        >
                          {dayLabels[day] || day}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">
                        Not specified
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Available Locations
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableLocations.length > 0 ? (
                      availableLocations.map((location: string) => (
                        <Badge
                          key={location}
                          variant="outline"
                          className="border-green-500/20 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {locationLabels[location] || location}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground italic">
                        Not specified
                      </span>
                    )}
                  </div>
                </div>
                <div className="pt-4 border-t space-y-1">
                  <label className="text-sm font-medium">
                    How did they hear about us?
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {volunteer.howDidYouHearAboutUs
                      ? hearAboutLabels[volunteer.howDidYouHearAboutUs] ||
                        volunteer.howDidYouHearAboutUs
                      : "Not specified"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Additional Information */}
            <Card data-testid="additional-information-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 dark:bg-muted/30 rounded-lg space-y-1">
                    <label className="text-sm font-medium">
                      Medical Conditions
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {volunteer.medicalConditions || "None specified"}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 dark:bg-muted/30 rounded-lg space-y-1">
                    <label className="text-sm font-medium">
                      Willing to provide reference
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {volunteer.willingToProvideReference ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 dark:bg-muted/30 rounded-lg space-y-1">
                    <label className="text-sm font-medium">Member since</label>
                    <p className="text-sm text-muted-foreground">
                      {format(volunteer.createdAt, "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 dark:bg-muted/30 rounded-lg space-y-1">
                    <label className="text-sm font-medium">Newsletter</label>
                    <p className="text-sm text-muted-foreground">
                      {volunteer.emailNewsletterSubscription
                        ? "Subscribed"
                        : "Not subscribed"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shift History with Location Filter */}
            <Card data-testid="shift-history-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <CardTitle>Shift History</CardTitle>
                    {selectedLocation && (
                      <Badge
                        variant="outline"
                        className="border-indigo-500/20 text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20"
                      >
                        <Filter className="h-3 w-3 mr-1" />
                        {selectedLocation}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Location Filter Buttons */}
                    <div className="flex items-center gap-1 bg-muted dark:bg-muted/50 rounded-lg p-1">
                      <Link
                        href={`/admin/volunteers/${id}`}
                        className={cn(
                          "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                          !selectedLocation
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        All
                      </Link>
                      {LOCATIONS.map((location) => (
                        <Link
                          key={location}
                          href={`/admin/volunteers/${id}?location=${location}`}
                          className={cn(
                            "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                            selectedLocation === location
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {location}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {volunteer.signups.length === 0 ? (
                  <div
                    className="text-center py-8"
                    data-testid="shift-history-empty-state"
                  >
                    <Clock className="h-12 w-12 text-muted-foreground/30 dark:text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {selectedLocation
                        ? `No shift signups found for ${selectedLocation}`
                        : "No shift signups yet"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3" data-testid="shift-history-list">
                    {volunteer.signups
                      .slice(0, 10)
                      .map((signup: (typeof volunteer.signups)[0]) => (
                        <div
                          key={signup.id}
                          className="flex items-center justify-between p-4 bg-muted/30 dark:bg-muted/20 rounded-lg hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">
                                {signup.shift.shiftType.name}
                              </h4>
                              {signup.shift.location && (
                                <Badge variant="outline">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {signup.shift.location}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatInNZT(
                                  signup.shift.start,
                                  "EEE dd MMM yyyy"
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatInNZT(
                                  signup.shift.start,
                                  "h:mma"
                                )} – {formatInNZT(signup.shift.end, "h:mma")}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                signup.status === "CONFIRMED"
                                  ? "default"
                                  : signup.status === "WAITLISTED"
                                  ? "secondary"
                                  : "outline"
                              }
                              className={cn(
                                signup.status === "CONFIRMED" &&
                                  "bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/30",
                                signup.status === "PENDING" &&
                                  "bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/30",
                                signup.status === "WAITLISTED" &&
                                  "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-950/30",
                                signup.status === "CANCELED" &&
                                  "bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/30",
                                signup.status === "NO_SHOW" &&
                                  "bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/30"
                              )}
                            >
                              {signup.status === "CONFIRMED" && "Confirmed"}
                              {signup.status === "PENDING" && "Pending"}
                              {signup.status === "WAITLISTED" && "Waitlisted"}
                              {signup.status === "CANCELED" && "Canceled"}
                              {signup.status === "NO_SHOW" && "No-show"}
                            </Badge>
                            {signup.shift.start < now && (
                              <Badge
                                variant="outline"
                                className="text-muted-foreground"
                              >
                                Past
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    {volunteer.signups.length > 10 && (
                      <div className="text-center py-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          Showing 10 most recent of {volunteer.signups.length}{" "}
                          total shifts
                          {selectedLocation && ` in ${selectedLocation}`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
    </AdminPageWrapper>
  );
}

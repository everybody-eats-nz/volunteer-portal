import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
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
  Clock,
  MapPin,
  Phone,
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
import { type VolunteerGrade } from "@prisma/client";
import { LOCATIONS, LocationOption } from "@/lib/locations";

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

  const hearAboutLabels: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    website: "Website",
    friend: "Friend/Word of mouth",
    community_board: "Community board",
    volunteer_website: "Volunteer website",
    other: "Other",
    not_specified: "Not specified",
  };

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
                  <p className="text-sm text-muted-foreground mb-4">
                    Pronouns: {volunteer.pronouns}
                  </p>
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
                          ? "border-yellow-500/20 text-yellow-700 bg-yellow-50"
                          : "border-gray-500/20 text-gray-700 bg-gray-50"
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
                    className="border-green-500/20 text-green-700 bg-green-50"
                  >
                    <Heart className="h-3 w-3 mr-1" />
                    Active Member
                  </Badge>
                  {volunteer.volunteerAgreementAccepted && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/20 text-emerald-700 bg-emerald-50"
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
                    <div className="text-2xl font-bold text-green-600">
                      {completedShifts}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Completed
                    </div>
                  </div>
                  {confirmedCancellations > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {confirmedCancellations}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Canceled
                      </div>
                    </div>
                  )}
                  {noShows > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
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
                  <Shield className="h-5 w-5 text-purple-600" />
                  Admin Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">User Role</label>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={
                        volunteer.role === "ADMIN"
                          ? "bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border-purple-200 font-medium shadow-sm"
                          : "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200 font-medium shadow-sm"
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
              </CardContent>
            </Card>

            {/* Admin Notes */}
            <Card data-testid="admin-notes-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-600" />
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
            <Card data-testid="contact-information-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Phone</label>
                      <p className="text-sm text-muted-foreground">
                        {volunteer.phone || "Not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="space-y-1">
                      <label className="text-sm font-medium">
                        Date of Birth
                      </label>
                      <p className="text-sm text-muted-foreground">
                        {volunteer.dateOfBirth
                          ? format(volunteer.dateOfBirth, "dd MMM yyyy")
                          : "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card data-testid="emergency-contact-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
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
                    <Star className="h-5 w-5 text-yellow-600" />
                    Regular Volunteer Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                      <label className="text-sm font-medium">Shift Type</label>
                      <p className="text-sm text-muted-foreground">
                        {volunteer.regularVolunteer.shiftType.name}
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                      <label className="text-sm font-medium">Location</label>
                      <p className="text-sm text-muted-foreground">
                        {volunteer.regularVolunteer.location}
                      </p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg space-y-1">
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
                    <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                      <label className="text-sm font-medium">Status</label>
                      <div className="flex items-center gap-2">
                        {volunteer.regularVolunteer.isActive ? (
                          volunteer.regularVolunteer.isPausedByUser ? (
                            <>
                              <PauseCircle className="h-4 w-4 text-yellow-600" />
                              <span className="text-sm text-yellow-600">
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
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-green-600">
                                Active
                              </span>
                            </>
                          )
                        ) : (
                          <>
                            <PauseCircle className="h-4 w-4 text-gray-600" />
                            <span className="text-sm text-gray-600">
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
                            className="border-yellow-500/20 text-yellow-700 bg-yellow-50"
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
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
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
                              className="text-sm p-2 bg-muted/30 rounded flex items-center justify-between"
                            >
                              <span>
                                {format(
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
                  <MapPin className="h-5 w-5 text-green-600" />
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
                          className="border-primary/20 text-primary bg-primary/5"
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
                          className="border-green-500/20 text-green-700 bg-green-50"
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
                  <Shield className="h-5 w-5 text-purple-600" />
                  Additional Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                    <label className="text-sm font-medium">
                      Medical Conditions
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {volunteer.medicalConditions || "None specified"}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                    <label className="text-sm font-medium">
                      Willing to provide reference
                    </label>
                    <p className="text-sm text-muted-foreground">
                      {volunteer.willingToProvideReference ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg space-y-1">
                    <label className="text-sm font-medium">Member since</label>
                    <p className="text-sm text-muted-foreground">
                      {format(volunteer.createdAt, "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg space-y-1">
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
                    <Clock className="h-5 w-5 text-indigo-600" />
                    <CardTitle>Shift History</CardTitle>
                    {selectedLocation && (
                      <Badge
                        variant="outline"
                        className="border-indigo-500/20 text-indigo-700 bg-indigo-50"
                      >
                        <Filter className="h-3 w-3 mr-1" />
                        {selectedLocation}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Location Filter Buttons */}
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
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
                    <Clock className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
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
                          className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
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
                                {format(signup.shift.start, "EEE dd MMM yyyy")}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(signup.shift.start, "h:mma")} –{" "}
                                {format(signup.shift.end, "h:mma")}
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
                                  "bg-green-100 text-green-800 border-green-200 hover:bg-green-100",
                                signup.status === "WAITLISTED" &&
                                  "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100",
                                signup.status === "CANCELED" &&
                                  "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100",
                                signup.status === "NO_SHOW" &&
                                  "bg-red-100 text-red-800 border-red-200 hover:bg-red-100"
                              )}
                            >
                              {signup.status === "CONFIRMED" && "Confirmed"}
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

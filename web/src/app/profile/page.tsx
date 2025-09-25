import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/page-container";
import { MotionCard } from "@/components/motion-card";
import { safeParseAvailability } from "@/lib/parse-availability";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  // Fetch complete user profile data and shift types
  let userProfile = null;
  let shiftTypes: { id: string; name: string; }[] = [];
  if (session?.user?.email) {
    [userProfile, shiftTypes] = await Promise.all([
      prisma.user.findUnique({
      where: { email: session.user.email },
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
        receiveShortageNotifications: true,
        excludedShortageNotificationTypes: true,
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
        role: true,
      },
      }),
      prisma.shiftType.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: 'asc'
        }
      })
    ]);
  }

  const userInitials =
    userProfile?.name || session?.user?.name
      ? (userProfile?.name || session?.user?.name)!
          .split(" ")
          .map((name: string) => name.charAt(0))
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : "U";

  const availableDays = safeParseAvailability(userProfile?.availableDays);
  const availableLocations = safeParseAvailability(userProfile?.availableLocations);

  return (
    <PageContainer testid="profile-page">
      <PageHeader
        title="Your Profile"
        description="Manage your volunteer account and track your impact"
      />

      {session?.user ? (
        <div className="space-y-8">
          {/* Profile Header */}
          <MotionCard>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="relative">
                  <Avatar className="w-36 h-36 shadow-lg">
                    <AvatarImage
                      src={userProfile?.profilePhotoUrl || undefined}
                      alt="Profile"
                      className="object-cover"
                    />
                    <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-primary-700 text-white">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-2xl font-bold mb-2">
                    {userProfile?.name || session.user.name || "Volunteer"}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {userProfile?.email || session.user.email}
                  </p>
                  {userProfile?.pronouns && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Pronouns: {userProfile.pronouns}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <Badge className="badge-primary" data-testid="user-role">
                      {userProfile?.role === "ADMIN"
                        ? "Administrator"
                        : "Volunteer"}
                    </Badge>
                    <Badge variant="outline" className="badge-accent">
                      Active Member
                    </Badge>
                    {userProfile?.volunteerAgreementAccepted && (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-200 dark:text-green-400 dark:border-green-800"
                      >
                        Agreement Signed
                      </Badge>
                    )}
                  </div>

                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href="/profile/edit"
                      className="flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Edit Profile
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </MotionCard>

          {/* Profile Details Grid */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Personal Information */}
            <MotionCard className="h-fit">
              <CardContent className="px-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2
                      className="text-xl font-semibold"
                      data-testid="personal-info-heading"
                    >
                      Personal Information
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Your account details
                    </p>
                  </div>
                </div>

                <div className="space-y-4" data-testid="personal-info-section">
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <span
                      className="text-sm font-medium text-muted-foreground"
                      data-testid="personal-info-name-label"
                    >
                      Name
                    </span>
                    <span className="font-medium">
                      {userProfile?.name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <span
                      className="text-sm font-medium text-muted-foreground"
                      data-testid="personal-info-email-label"
                    >
                      Email
                    </span>
                    <span className="font-medium">
                      {userProfile?.email || "—"}
                    </span>
                  </div>
                  {userProfile?.phone && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-sm font-medium text-muted-foreground">
                        Phone
                      </span>
                      <span className="font-medium">{userProfile.phone}</span>
                    </div>
                  )}
                  {userProfile?.dateOfBirth && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-sm font-medium text-muted-foreground">
                        Date of Birth
                      </span>
                      <span className="font-medium">
                        {new Date(userProfile.dateOfBirth).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-3">
                    <span
                      className="text-sm font-medium text-muted-foreground"
                      data-testid="personal-info-account-type-label"
                    >
                      Account Type
                    </span>
                    <span className="font-medium">
                      {userProfile?.role === "ADMIN"
                        ? "Administrator"
                        : "Volunteer"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </MotionCard>

            {/* Emergency Contact & Availability */}
            <MotionCard className="h-fit">
              <CardContent className="px-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2
                      className="text-xl font-semibold"
                      data-testid="emergency-contact-heading"
                    >
                      Emergency Contact
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Emergency contact information
                    </p>
                  </div>
                </div>

                <div
                  className="space-y-4"
                  data-testid="emergency-contact-section"
                >
                  {userProfile?.emergencyContactName ? (
                    <>
                      <div className="flex justify-between items-center py-3 border-b border-border">
                        <span
                          className="text-sm font-medium text-muted-foreground"
                          data-testid="emergency-contact-name-label"
                        >
                          Name
                        </span>
                        <span className="font-medium">
                          {userProfile.emergencyContactName}
                        </span>
                      </div>
                      {userProfile.emergencyContactRelationship && (
                        <div className="flex justify-between items-center py-3 border-b border-border">
                          <span className="text-sm font-medium text-muted-foreground">
                            Relationship
                          </span>
                          <span className="font-medium">
                            {userProfile.emergencyContactRelationship}
                          </span>
                        </div>
                      )}
                      {userProfile.emergencyContactPhone && (
                        <div className="flex justify-between items-center py-3">
                          <span className="text-sm font-medium text-muted-foreground">
                            Phone
                          </span>
                          <span className="font-medium">
                            {userProfile.emergencyContactPhone}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No emergency contact information provided
                    </p>
                  )}
                </div>
              </CardContent>
            </MotionCard>

            {/* Availability Information */}
            <MotionCard className="h-fit">
              <CardContent className="px-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-purple-600 dark:text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2
                      className="text-xl font-semibold"
                      data-testid="availability-heading"
                    >
                      Availability
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      When and where you can volunteer
                    </p>
                  </div>
                </div>

                <div className="space-y-4" data-testid="availability-section">
                  {availableDays.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Available Days:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {availableDays.map((day: string) => (
                          <Badge
                            key={day}
                            variant="outline"
                            className="text-xs"
                          >
                            {day.charAt(0).toUpperCase() + day.slice(1)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {availableLocations.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Available Locations:
                      </span>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {availableLocations.map((location: string) => (
                          <Badge
                            key={location}
                            variant="outline"
                            className="text-xs"
                          >
                            {location.charAt(0).toUpperCase() +
                              location.slice(1)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {availableDays.length === 0 &&
                    availableLocations.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">
                        No availability preferences set
                      </p>
                    )}
                </div>
              </CardContent>
            </MotionCard>

            {/* Notification Preferences */}
            <MotionCard className="h-fit">
              <CardContent className="px-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-orange-600 dark:text-orange-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      Shift Shortage Notifications
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Control your notification preferences
                    </p>
                  </div>
                </div>

                <div className="space-y-4" data-testid="notification-preferences-section">
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <span className="text-sm font-medium text-muted-foreground">
                      Receive Notifications
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={userProfile?.receiveShortageNotifications || false}
                        readOnly
                        data-testid="receive-notifications-toggle"
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">
                        {userProfile?.receiveShortageNotifications ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>

                  {userProfile?.receiveShortageNotifications && (
                    <>
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">
                          Shift types you&apos;d like notifications for:
                        </span>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {shiftTypes
                            .filter((type) => 
                              !userProfile?.excludedShortageNotificationTypes?.includes(type.id)
                            )
                            .map((type) => (
                              <Badge
                                key={type.id}
                                variant="outline"
                                className="text-xs"
                              >
                                {type.name}
                              </Badge>
                            ))}
                        </div>
                      </div>
                      
                      {userProfile?.excludedShortageNotificationTypes?.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Excluded shift types:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {shiftTypes
                              .filter((type) => 
                                userProfile?.excludedShortageNotificationTypes?.includes(type.id)
                              )
                              .map((type) => (
                                <Badge
                                  key={type.id}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {type.name}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="edit-notification-preferences"
                      asChild
                    >
                      <Link href="/profile/edit?step=communication">Edit Preferences</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </MotionCard>

            {/* Quick Actions */}
            <MotionCard className="h-fit">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-amber-600 dark:text-amber-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2
                      className="text-xl font-semibold"
                      data-testid="quick-actions-heading"
                    >
                      Quick Actions
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage your volunteer experience
                    </p>
                  </div>
                </div>

                <div className="space-y-3" data-testid="quick-actions-section">
                  <Button
                    asChild
                    variant="outline"
                    className="w-full justify-start"
                    data-testid="browse-shifts-button"
                  >
                    <Link href="/shifts" className="flex items-center gap-3">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Browse Available Shifts
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    className="w-full justify-start"
                    data-testid="view-schedule-button"
                  >
                    <Link
                      href="/shifts/mine"
                      className="flex items-center gap-3"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      View My Schedule
                    </Link>
                  </Button>

                  <div className="pt-4 border-t border-border">
                    <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-4 border border-primary/20 dark:border-primary/30">
                      <div className="flex items-start gap-3">
                        <svg
                          className="w-5 h-5 text-primary mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div>
                          <p className="font-medium text-primary">
                            Complete your profile!
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Add your emergency contact, availability, and
                            preferences to get the most out of your volunteer
                            experience.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </MotionCard>
          </div>
        </div>
      ) : (
        <MotionCard>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-primary/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Sign in required</h3>
            <p className="text-muted-foreground mb-4">
              Please sign in to view and manage your profile.
            </p>
            <Button asChild>
              <Link href="/login">Sign in to your account</Link>
            </Button>
          </CardContent>
        </MotionCard>
      )}
    </PageContainer>
  );
}

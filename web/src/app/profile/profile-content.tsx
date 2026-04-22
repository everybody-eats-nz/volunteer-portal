import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { MotionCard } from "@/components/motion-card";
import { MotionContentCard } from "@/components/motion-content-card";
import { ContentGrid } from "@/components/dashboard-animated";
import { safeParseAvailability } from "@/lib/parse-availability";
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  HeartPulse,
  Info,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Sparkles,
  User as UserIcon,
  UserCircle,
} from "lucide-react";

export async function ProfileContent() {
  const session = await getServerSession(authOptions);

  // Fetch complete user profile data, shift types, and newsletter lists
  let userProfile = null;
  let shiftTypes: { id: string; name: string }[] = [];
  let newsletterLists: {
    id: string;
    name: string;
    campaignMonitorId: string;
  }[] = [];
  if (session?.user?.email) {
    [userProfile, shiftTypes, newsletterLists] = await Promise.all([
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
          defaultLocation: true,
          emailNewsletterSubscription: true,
          newsletterLists: true,
          notificationPreference: true,
          receiveShortageNotifications: true,
          excludedShortageNotificationTypes: true,
          volunteerAgreementAccepted: true,
          healthSafetyPolicyAccepted: true,
          role: true,
        },
      }),
      prisma.shiftType.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.newsletterList.findMany({
        where: { active: true },
        select: { id: true, name: true, campaignMonitorId: true },
        orderBy: { displayOrder: "asc" },
      }),
    ]);
  }

  const displayName =
    userProfile?.name || session?.user?.name || "Volunteer";
  const userInitials = displayName
    .split(" ")
    .map((n: string) => n.charAt(0))
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const availableDays = safeParseAvailability(userProfile?.availableDays);
  const availableLocations = safeParseAvailability(
    userProfile?.availableLocations
  );

  const isProfileIncomplete =
    !userProfile?.phone ||
    !userProfile?.dateOfBirth ||
    !userProfile?.emergencyContactName ||
    !userProfile?.emergencyContactPhone ||
    !userProfile?.volunteerAgreementAccepted ||
    !userProfile?.healthSafetyPolicyAccepted;

  if (!session?.user) {
    return (
      <MotionCard>
        <CardContent className="p-10 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-8 h-8 text-primary/70" />
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
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <MotionCard>
        <CardContent className="p-8 md:p-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <Avatar className="w-32 h-32 md:w-36 md:h-36 ring-4 ring-primary/10 dark:ring-primary/20 shadow-lg">
              <AvatarImage
                src={userProfile?.profilePhotoUrl || undefined}
                alt={displayName}
                className="object-cover"
              />
              <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary to-primary-700 text-white">
                {userInitials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 text-center md:text-left">
              <h2
                className="font-accent text-4xl md:text-5xl font-bold tracking-tight text-foreground"
                style={{ fontVariationSettings: '"SOFT" 50' }}
              >
                {displayName}
              </h2>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-muted-foreground justify-center md:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  {userProfile?.email || session.user.email}
                </span>
                {userProfile?.pronouns && (
                  <span className="hidden sm:inline text-border">•</span>
                )}
                {userProfile?.pronouns && (
                  <span>{userProfile.pronouns}</span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 justify-center md:justify-start">
                <Badge className="badge-primary" data-testid="user-role">
                  {userProfile?.role === "ADMIN"
                    ? "Administrator"
                    : "Volunteer"}
                </Badge>
                {userProfile?.defaultLocation && (
                  <Badge variant="outline" className="gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {userProfile.defaultLocation}
                  </Badge>
                )}
                {userProfile?.volunteerAgreementAccepted && (
                  <Badge
                    variant="outline"
                    className="text-green-700 border-green-200 bg-green-50/60 dark:text-green-400 dark:border-green-900/60 dark:bg-green-950/30"
                  >
                    Agreement signed
                  </Badge>
                )}
              </div>
            </div>

            <Button asChild variant="outline" className="self-stretch md:self-start">
              <Link href="/profile/edit" className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />
                Edit profile
              </Link>
            </Button>
          </div>
        </CardContent>
      </MotionCard>

      {/* Incomplete profile nudge */}
      {isProfileIncomplete && (
        <MotionCard>
          <CardContent className="flex items-start gap-4 p-5 md:p-6">
            <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
              <Info className="w-5 h-5 text-primary dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Finish setting up your profile</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add your emergency contact, availability, and preferences so we
                can match you to the right shifts.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/profile/edit">Complete profile</Link>
            </Button>
          </CardContent>
        </MotionCard>
      )}

      {/* Details grid */}
      <ContentGrid>
        {/* Personal Information */}
        <MotionContentCard delay={0.05}>
          <CardHeader>
            <CardTitle
              className="flex items-center gap-2 text-xl"
              data-testid="personal-info-heading"
            >
              <UserIcon className="w-5 h-5 text-primary dark:text-emerald-400" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl
              className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm"
              data-testid="personal-info-section"
            >
              <dt
                className="text-muted-foreground"
                data-testid="personal-info-name-label"
              >
                Name
              </dt>
              <dd className="font-medium text-right">
                {userProfile?.name || "—"}
              </dd>

              <dt
                className="text-muted-foreground"
                data-testid="personal-info-email-label"
              >
                Email
              </dt>
              <dd className="font-medium text-right break-all">
                {userProfile?.email || "—"}
              </dd>

              {userProfile?.phone && (
                <>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-medium text-right">
                    {userProfile.phone}
                  </dd>
                </>
              )}

              {userProfile?.dateOfBirth && (
                <>
                  <dt className="text-muted-foreground">Date of birth</dt>
                  <dd className="font-medium text-right">
                    {new Date(userProfile.dateOfBirth).toLocaleDateString(
                      "en-NZ"
                    )}
                  </dd>
                </>
              )}

              <dt
                className="text-muted-foreground"
                data-testid="personal-info-account-type-label"
              >
                Account type
              </dt>
              <dd className="font-medium text-right">
                {userProfile?.role === "ADMIN" ? "Administrator" : "Volunteer"}
              </dd>
            </dl>
          </CardContent>
        </MotionContentCard>

        {/* Emergency Contact */}
        <MotionContentCard delay={0.1}>
          <CardHeader>
            <CardTitle
              className="flex items-center gap-2 text-xl"
              data-testid="emergency-contact-heading"
            >
              <HeartPulse className="w-5 h-5 text-primary dark:text-emerald-400" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="emergency-contact-section">
              {userProfile?.emergencyContactName ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
                  <dt
                    className="text-muted-foreground"
                    data-testid="emergency-contact-name-label"
                  >
                    Name
                  </dt>
                  <dd className="font-medium text-right">
                    {userProfile.emergencyContactName}
                  </dd>

                  {userProfile.emergencyContactRelationship && (
                    <>
                      <dt className="text-muted-foreground">Relationship</dt>
                      <dd className="font-medium text-right">
                        {userProfile.emergencyContactRelationship}
                      </dd>
                    </>
                  )}

                  {userProfile.emergencyContactPhone && (
                    <>
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd className="font-medium text-right">
                        {userProfile.emergencyContactPhone}
                      </dd>
                    </>
                  )}
                </dl>
              ) : (
                <EmptyState
                  icon={Phone}
                  message="No emergency contact on file yet."
                />
              )}
            </div>
          </CardContent>
        </MotionContentCard>

        {/* Availability */}
        <MotionContentCard delay={0.15}>
          <CardHeader>
            <CardTitle
              className="flex items-center gap-2 text-xl"
              data-testid="availability-heading"
            >
              <CalendarDays className="w-5 h-5 text-primary dark:text-emerald-400" />
              Availability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="space-y-5 text-sm"
              data-testid="availability-section"
            >
              {userProfile?.defaultLocation && (
                <Field label="Default location">
                  <Badge variant="outline" className="gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {userProfile.defaultLocation}
                  </Badge>
                </Field>
              )}

              {availableDays.length > 0 && (
                <Field label="Available days">
                  <div className="flex flex-wrap gap-1.5">
                    {availableDays.map((day: string) => (
                      <Badge key={day} variant="outline" className="text-xs">
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </Badge>
                    ))}
                  </div>
                </Field>
              )}

              {availableLocations.length > 0 && (
                <Field label="Preferred locations">
                  <div className="flex flex-wrap gap-1.5">
                    {availableLocations.map((location: string) => (
                      <Badge
                        key={location}
                        variant="outline"
                        className="text-xs"
                      >
                        {location.charAt(0).toUpperCase() + location.slice(1)}
                      </Badge>
                    ))}
                  </div>
                </Field>
              )}

              {availableDays.length === 0 &&
                availableLocations.length === 0 &&
                !userProfile?.defaultLocation && (
                  <EmptyState
                    icon={CalendarDays}
                    message="No availability preferences set yet."
                  />
                )}
            </div>
          </CardContent>
        </MotionContentCard>

        {/* Notifications */}
        <MotionContentCard delay={0.2}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Bell className="w-5 h-5 text-primary dark:text-emerald-400" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="space-y-5 text-sm"
              data-testid="notification-preferences-section"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Shortage alerts</span>
                <Badge
                  variant="outline"
                  data-testid="receive-notifications-toggle"
                  className={
                    userProfile?.receiveShortageNotifications
                      ? "text-green-700 border-green-200 bg-green-50/60 dark:text-green-400 dark:border-green-900/60 dark:bg-green-950/30"
                      : "text-muted-foreground"
                  }
                >
                  {userProfile?.receiveShortageNotifications
                    ? "Enabled"
                    : "Disabled"}
                </Badge>
              </div>

              {userProfile?.receiveShortageNotifications && (
                <>
                  <Field label="Receiving alerts for">
                    <div className="flex flex-wrap gap-1.5">
                      {shiftTypes
                        .filter(
                          (type) =>
                            !userProfile?.excludedShortageNotificationTypes?.includes(
                              type.id
                            )
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
                  </Field>

                  {userProfile?.excludedShortageNotificationTypes?.length >
                    0 && (
                    <Field label="Muted shift types">
                      <div className="flex flex-wrap gap-1.5">
                        {shiftTypes
                          .filter((type) =>
                            userProfile?.excludedShortageNotificationTypes?.includes(
                              type.id
                            )
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
                    </Field>
                  )}
                </>
              )}

              <div className="border-t pt-5 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Newsletter</span>
                  <Badge
                    variant="outline"
                    className={
                      userProfile?.emailNewsletterSubscription
                        ? "text-green-700 border-green-200 bg-green-50/60 dark:text-green-400 dark:border-green-900/60 dark:bg-green-950/30"
                        : "text-muted-foreground"
                    }
                  >
                    {userProfile?.emailNewsletterSubscription
                      ? "Subscribed"
                      : "Not subscribed"}
                  </Badge>
                </div>

                {userProfile?.emailNewsletterSubscription &&
                  userProfile?.newsletterLists?.length > 0 && (
                    <Field label="Subscribed to">
                      <div className="flex flex-wrap gap-1.5">
                        {userProfile.newsletterLists.map((listId: string) => {
                          const list = newsletterLists.find(
                            (l) => l.campaignMonitorId === listId
                          );
                          return (
                            <Badge
                              key={listId}
                              variant="outline"
                              className="text-xs"
                            >
                              {list?.name || listId}
                            </Badge>
                          );
                        })}
                      </div>
                    </Field>
                  )}
              </div>

              <div className="border-t pt-5">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="edit-notification-preferences"
                  asChild
                >
                  <Link
                    href="/profile/edit?step=communication"
                    className="flex items-center gap-2"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit preferences
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </MotionContentCard>

        {/* Quick Actions */}
        <MotionContentCard delay={0.25}>
          <CardHeader>
            <CardTitle
              className="flex items-center gap-2 text-xl"
              data-testid="quick-actions-heading"
            >
              <Sparkles className="w-5 h-5 text-primary dark:text-emerald-400" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="quick-actions-section">
              <Button
                asChild
                variant="outline"
                className="w-full justify-start"
                data-testid="browse-shifts-button"
              >
                <Link href="/shifts" className="flex items-center gap-3">
                  <CalendarPlus className="w-4 h-4" />
                  Browse available shifts
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="w-full justify-start"
                data-testid="view-schedule-button"
              >
                <Link href="/shifts/mine" className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4" />
                  View my schedule
                </Link>
              </Button>
            </div>
          </CardContent>
        </MotionContentCard>
      </ContentGrid>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-muted-foreground mb-2">{label}</div>
      {children}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-6 text-muted-foreground">
      <Icon className="w-6 h-6 mb-2 opacity-60" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

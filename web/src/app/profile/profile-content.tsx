import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import Image from "next/image";
import { MotionCard } from "@/components/motion-card";
import { ContentGrid } from "@/components/dashboard-animated";
import { safeParseAvailability } from "@/lib/parse-availability";

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

/* Shared styling for the detail cards — paper card with forest hairline,
   matching the marketing-site card system. */
const detailCard =
  "rounded-3xl border-forest-500/10 bg-card shadow-none py-0 dark:border-cream-50/10";

/** Round forest icon tile that leads each card heading. */
function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-500/10 text-forest-500 dark:bg-cream-50/10 dark:text-cream-50">
      {children}
    </div>
  );
}

/** Editorial card heading — icon tile + Fraunces title + quiet subtitle. */
function CardHeading({
  icon,
  title,
  subtitle,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  testId?: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <IconTile>{icon}</IconTile>
      <div>
        <h2
          className="display display-medium text-2xl tracking-tight text-forest-700 dark:text-cream-50"
          data-testid={testId}
        >
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-forest-700/60 dark:text-cream-50/60">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

/** A label/value row with a hairline divider. */
function DetailRow({
  label,
  value,
  labelTestId,
  last = false,
}: {
  label: string;
  value: React.ReactNode;
  labelTestId?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 ${
        last ? "" : "border-b border-forest-500/10 dark:border-cream-50/10"
      }`}
    >
      <span
        className="eyebrow shrink-0 text-forest-500/70 dark:text-cream-50/55"
        data-testid={labelTestId}
      >
        {label}
      </span>
      <span className="text-right text-sm font-medium text-forest-700 dark:text-cream-50">
        {value}
      </span>
    </div>
  );
}

/** Small brand chip for days, locations, shift types and newsletters. */
function Chip({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
        muted
          ? "border-forest-500/10 bg-transparent text-forest-700/50 dark:border-cream-50/10 dark:text-cream-50/50"
          : "border-forest-500/15 bg-forest-500/5 text-forest-700 dark:border-cream-50/15 dark:bg-cream-50/5 dark:text-cream-50"
      }`}
    >
      {children}
    </span>
  );
}

/** On/off status pill (Enabled / Subscribed, etc.) with a state dot. */
function StatusPill({
  on,
  onLabel,
  offLabel,
  testId,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        on
          ? "border-forest-500/20 bg-forest-500/10 text-forest-600 dark:border-cream-50/15 dark:bg-cream-50/10 dark:text-cream-50"
          : "border-forest-500/15 text-forest-700/50 dark:border-cream-50/15 dark:text-cream-50/50"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          on ? "bg-forest-500 dark:bg-sun-200" : "bg-forest-500/30 dark:bg-cream-50/30"
        }`}
      />
      {on ? onLabel : offLabel}
    </span>
  );
}

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
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.newsletterList.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          campaignMonitorId: true,
        },
        orderBy: {
          displayOrder: "asc",
        },
      }),
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
  const availableLocations = safeParseAvailability(
    userProfile?.availableLocations
  );

  // Check if profile is incomplete based on required fields
  const isProfileIncomplete =
    !userProfile?.phone ||
    !userProfile?.dateOfBirth ||
    !userProfile?.emergencyContactName ||
    !userProfile?.emergencyContactPhone ||
    !userProfile?.volunteerAgreementAccepted ||
    !userProfile?.healthSafetyPolicyAccepted;

  if (!session?.user) {
    return (
      <section className="grain relative overflow-hidden rounded-[2rem] bg-forest-700 px-6 py-14 text-center text-cream-50 sm:rounded-[2.5rem] sm:px-12">
        {/* Warm sun glow — radial gradient rather than a blur filter, which
            escapes the rounded-corner clip on composited layers in Chromium */}
        <div
          aria-hidden
          className="absolute -bottom-28 -right-24 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.18),transparent)]"
        />
        <div className="relative mx-auto max-w-md">
          <p className="eyebrow mb-5 flex items-center justify-center gap-3 text-sun-200/90">
            <span className="inline-block h-px w-8 bg-sun-200/50" />
            Kia ora
            <span className="inline-block h-px w-8 bg-sun-200/50" />
          </p>
          <h3 className="display text-3xl tracking-tight sm:text-4xl">
            Sign in required
          </h3>
          <p className="mt-4 leading-relaxed text-cream-50/80">
            Please sign in to view and manage your profile.
          </p>
          <Button
            asChild
            className="mt-8 h-11 bg-cream-50 px-7 text-forest-700 hover:bg-cream-100 hover:text-forest-700"
          >
            <Link href="/login">Sign in to your account</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {/* ============ Identity panel ============ */}
      <section className="grain relative overflow-hidden rounded-[2rem] bg-forest-700 text-cream-50 sm:rounded-[2.5rem]">
        {/* Warm sun glow — radial gradient rather than a blur filter, which
            escapes the rounded-corner clip on composited layers in Chromium */}
        <div
          aria-hidden
          className="absolute -bottom-32 -right-28 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgb(248_251_105/0.16),transparent)]"
        />
        <Image
          src="/patterns/kawakawa.avif"
          alt=""
          width={416}
          height={416}
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-10 w-64 opacity-15 sm:w-80"
        />

        <div className="relative flex flex-col items-center gap-8 px-6 py-10 text-center sm:px-10 sm:py-12 md:flex-row md:text-left">
          <div className="relative shrink-0">
            <Avatar className="h-28 w-28 ring-4 ring-sun-200/90 sm:h-36 sm:w-36">
              <AvatarImage
                src={userProfile?.profilePhotoUrl || undefined}
                alt="Profile"
                className="object-cover"
              />
              <AvatarFallback className="display display-medium bg-cream-50 text-3xl text-forest-700 sm:text-4xl">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <Sparkle className="absolute -right-1 -top-1 h-6 w-6 text-sun-200" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-3 flex items-center justify-center gap-3 text-sun-200/90 md:justify-start">
              <span className="hidden h-px w-8 bg-sun-200/50 md:inline-block" />
              Kia ora
            </p>
            <h2 className="display text-3xl leading-[1.05] tracking-tight sm:text-4xl">
              {userProfile?.name || session.user.name || "Volunteer"}
            </h2>
            <p className="mt-2 break-words text-cream-50/75">
              {userProfile?.email || session.user.email}
            </p>
            {userProfile?.pronouns && (
              <p className="mt-1 text-sm text-cream-50/60">
                Pronouns: {userProfile.pronouns}
              </p>
            )}

            <div className="mt-5 flex flex-wrap justify-center gap-2 md:justify-start">
              <span
                className="inline-flex items-center rounded-full bg-sun-200 px-3.5 py-1 text-xs font-semibold text-forest-700"
                data-testid="user-role"
              >
                {userProfile?.role === "ADMIN" ? "Administrator" : "Volunteer"}
              </span>
              <span className="inline-flex items-center rounded-full border border-cream-50/30 px-3.5 py-1 text-xs font-medium text-cream-50/90">
                Active Member
              </span>
              {userProfile?.volunteerAgreementAccepted && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cream-50/30 px-3.5 py-1 text-xs font-medium text-cream-50/90">
                  <svg
                    className="h-3 w-3 text-sun-200"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Agreement Signed
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <Button
              asChild
              className="h-11 bg-cream-50 px-6 text-forest-700 hover:bg-cream-100 hover:text-forest-700"
            >
              <Link href="/profile/edit" className="flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
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
      </section>

      {/* ============ Profile details grid ============ */}
      <ContentGrid>
        {/* Personal Information */}
        <MotionCard className={detailCard}>
          <CardContent className="p-6 sm:p-8">
            <CardHeading
              testId="personal-info-heading"
              title="Personal Information"
              subtitle="Your account details"
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              }
            />

            <div data-testid="personal-info-section">
              <DetailRow
                label="Name"
                labelTestId="personal-info-name-label"
                value={userProfile?.name || "—"}
              />
              <DetailRow
                label="Email"
                labelTestId="personal-info-email-label"
                value={userProfile?.email || "—"}
              />
              {userProfile?.phone && (
                <DetailRow label="Phone" value={userProfile.phone} />
              )}
              {userProfile?.dateOfBirth && (
                <DetailRow
                  label="Date of Birth"
                  value={new Date(userProfile.dateOfBirth).toLocaleDateString(
                    "en-NZ"
                  )}
                />
              )}
              <DetailRow
                label="Account Type"
                labelTestId="personal-info-account-type-label"
                value={
                  userProfile?.role === "ADMIN" ? "Administrator" : "Volunteer"
                }
                last
              />
            </div>
          </CardContent>
        </MotionCard>

        {/* Emergency Contact */}
        <MotionCard className={detailCard}>
          <CardContent className="p-6 sm:p-8">
            <CardHeading
              testId="emergency-contact-heading"
              title="Emergency Contact"
              subtitle="Emergency contact information"
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              }
            />

            <div data-testid="emergency-contact-section">
              {userProfile?.emergencyContactName ? (
                <>
                  <DetailRow
                    label="Name"
                    labelTestId="emergency-contact-name-label"
                    value={userProfile.emergencyContactName}
                    last={
                      !userProfile.emergencyContactRelationship &&
                      !userProfile.emergencyContactPhone
                    }
                  />
                  {userProfile.emergencyContactRelationship && (
                    <DetailRow
                      label="Relationship"
                      value={userProfile.emergencyContactRelationship}
                      last={!userProfile.emergencyContactPhone}
                    />
                  )}
                  {userProfile.emergencyContactPhone && (
                    <DetailRow
                      label="Phone"
                      value={userProfile.emergencyContactPhone}
                      last
                    />
                  )}
                </>
              ) : (
                <p className="py-4 text-center text-sm leading-relaxed text-forest-700/60 dark:text-cream-50/60">
                  No emergency contact information provided
                </p>
              )}
            </div>
          </CardContent>
        </MotionCard>

        {/* Availability */}
        <MotionCard className={detailCard}>
          <CardContent className="p-6 sm:p-8">
            <CardHeading
              testId="availability-heading"
              title="Availability"
              subtitle="When and where you can volunteer"
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              }
            />

            <div className="space-y-5" data-testid="availability-section">
              {availableDays.length > 0 && (
                <div>
                  <span className="eyebrow text-forest-500/70 dark:text-cream-50/55">
                    Available Days:
                  </span>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {availableDays.map((day: string) => (
                      <Chip key={day}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {availableLocations.length > 0 && (
                <div>
                  <span className="eyebrow text-forest-500/70 dark:text-cream-50/55">
                    Available Locations:
                  </span>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {availableLocations.map((location: string) => (
                      <Chip key={location}>
                        {location.charAt(0).toUpperCase() + location.slice(1)}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {userProfile?.defaultLocation && (
                <div>
                  <span className="eyebrow text-forest-500/70 dark:text-cream-50/55">
                    Default Location:
                  </span>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Chip>{userProfile.defaultLocation}</Chip>
                  </div>
                </div>
              )}
              {availableDays.length === 0 &&
                availableLocations.length === 0 && (
                  <p className="py-4 text-center text-sm leading-relaxed text-forest-700/60 dark:text-cream-50/60">
                    No availability preferences set
                  </p>
                )}
            </div>
          </CardContent>
        </MotionCard>

        {/* Notification Preferences */}
        <MotionCard className={detailCard}>
          <CardContent className="p-6 sm:p-8">
            <CardHeading
              title="Shift Shortage Notifications"
              subtitle="Control your notification preferences"
              icon={
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
              }
            />

            <div
              className="space-y-5"
              data-testid="notification-preferences-section"
            >
              <div className="flex items-center justify-between gap-4 border-b border-forest-500/10 py-3 dark:border-cream-50/10">
                <span className="eyebrow text-forest-500/70 dark:text-cream-50/55">
                  Receive Notifications
                </span>
                <StatusPill
                  testId="receive-notifications-toggle"
                  on={!!userProfile?.receiveShortageNotifications}
                  onLabel="Enabled"
                  offLabel="Disabled"
                />
              </div>

              {userProfile?.receiveShortageNotifications && (
                <>
                  <div>
                    <span className="eyebrow text-forest-500/70 dark:text-cream-50/55">
                      Shift types you&apos;d like notifications for:
                    </span>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {shiftTypes
                        .filter(
                          (type) =>
                            !userProfile?.excludedShortageNotificationTypes?.includes(
                              type.id
                            )
                        )
                        .map((type) => (
                          <Chip key={type.id}>{type.name}</Chip>
                        ))}
                    </div>
                  </div>

                  {userProfile?.excludedShortageNotificationTypes?.length >
                    0 && (
                    <div>
                      <span className="eyebrow text-forest-500/70 dark:text-cream-50/55">
                        Excluded shift types:
                      </span>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {shiftTypes
                          .filter((type) =>
                            userProfile?.excludedShortageNotificationTypes?.includes(
                              type.id
                            )
                          )
                          .map((type) => (
                            <Chip key={type.id} muted>
                              {type.name}
                            </Chip>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-forest-500/10 pt-2 dark:border-cream-50/10">
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="eyebrow text-forest-500/70 dark:text-cream-50/55">
                    Newsletter Subscription
                  </span>
                  <StatusPill
                    on={!!userProfile?.emailNewsletterSubscription}
                    onLabel="Subscribed"
                    offLabel="Not subscribed"
                  />
                </div>

                {userProfile?.emailNewsletterSubscription &&
                  userProfile?.newsletterLists &&
                  userProfile.newsletterLists.length > 0 && (
                    <div className="mt-1">
                      <span className="eyebrow text-forest-500/70 dark:text-cream-50/55">
                        Subscribed to:
                      </span>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {userProfile.newsletterLists.map((listId: string) => {
                          const list = newsletterLists.find(
                            (l) => l.campaignMonitorId === listId
                          );
                          return <Chip key={listId}>{list?.name || listId}</Chip>;
                        })}
                      </div>
                    </div>
                  )}
              </div>

              <div className="border-t border-forest-500/10 pt-5 dark:border-cream-50/10">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-forest-500/20 px-4 text-forest-700 hover:bg-forest-500 hover:text-cream-50 hover:-translate-y-0.5 hover:shadow-lg dark:border-cream-50/20 dark:bg-transparent dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
                  data-testid="edit-notification-preferences"
                  asChild
                >
                  <Link href="/profile/edit?step=communication">
                    Edit Preferences
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </MotionCard>

        {/* Quick Actions */}
        <MotionCard className={detailCard}>
          <CardContent className="p-6 sm:p-8">
            <CardHeading
              testId="quick-actions-heading"
              title="Quick Actions"
              subtitle="Manage your volunteer experience"
              icon={<Sparkle className="h-4 w-4" />}
            />

            <div className="space-y-3" data-testid="quick-actions-section">
              <Button
                asChild
                variant="outline"
                className="h-11 w-full justify-start border-forest-500/20 bg-transparent px-5 text-forest-700 hover:bg-forest-500 hover:text-cream-50 hover:-translate-y-0.5 hover:shadow-lg dark:border-cream-50/20 dark:bg-transparent dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
                data-testid="browse-shifts-button"
              >
                <Link href="/shifts" className="flex items-center gap-3">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
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
                className="h-11 w-full justify-start border-forest-500/20 bg-transparent px-5 text-forest-700 hover:bg-forest-500 hover:text-cream-50 hover:-translate-y-0.5 hover:shadow-lg dark:border-cream-50/20 dark:bg-transparent dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700"
                data-testid="view-schedule-button"
              >
                <Link href="/shifts/mine" className="flex items-center gap-3">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
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

              {isProfileIncomplete && (
                <div className="pt-3">
                  <div className="grain rounded-2xl bg-sun-100 p-5 dark:bg-sun-200/10">
                    <div className="flex items-start gap-3">
                      <Sparkle className="mt-0.5 h-4 w-4 shrink-0 text-forest-500 dark:text-sun-200" />
                      <div>
                        <p className="font-accent font-medium text-forest-700 dark:text-sun-100">
                          Complete your profile!
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-forest-700/75 dark:text-cream-50/70">
                          Add your emergency contact, availability, and
                          preferences to get the most out of your volunteer
                          experience.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </MotionCard>
      </ContentGrid>
    </div>
  );
}

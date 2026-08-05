import { prisma } from "@/lib/prisma";
import { formatInNZT } from "@/lib/timezone";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { notFound } from "next/navigation";
import { getConcurrentShifts } from "@/lib/concurrent-shifts";
import { isAMShift, getShiftDate } from "@/lib/concurrent-shifts";
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
  CalendarDays,
  Timer,
  ExternalLink,
  Ticket,
} from "lucide-react";
import { getCmsEventsForShift } from "@/lib/services/marketing-cms";
import Link from "next/link";
import Image from "next/image";
import { ProfileCompletionBannerServer } from "@/components/profile-completion-banner-server";
import { generateCalendarUrls } from "@/lib/calendar-utils";
import { getShiftDescription } from "@/lib/shift-description";
import { getLocationAddresses, type Location } from "@/lib/locations";
import { ShiftSignupButton } from "@/components/shift-signup-button";
import { ShareShiftButton } from "@/components/share-shift-button";
import { getShiftTheme } from "@/lib/shift-themes";
import { Suspense } from "react";
import type { Metadata } from "next";
import { buildPageMetadata, buildShiftEventSchema } from "@/lib/seo";
import { getBaseUrl } from "@/lib/utils";

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      shiftType: { select: { name: true, description: true } },
      _count: {
        select: {
          signups: {
            where: { status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] } },
          },
          placeholders: true,
        },
      },
    },
  });

  if (!shift) {
    return buildPageMetadata({
      title: "Shift not found",
      description: "This volunteer shift could not be found.",
      path: `/shifts/${id}`,
      noIndex: true,
    });
  }

  const dayLabel = formatInNZT(new Date(shift.start), "EEEE d MMMM");
  const timeLabel = `${formatInNZT(new Date(shift.start), "h:mma")}–${formatInNZT(
    new Date(shift.end),
    "h:mma"
  )}`.toLowerCase();
  const locationPart = shift.location ? ` · ${shift.location}` : "";
  const title = `${shift.shiftType.name}${locationPart} · ${dayLabel}`;

  const confirmedCount = shift._count.signups + shift._count.placeholders;
  const spotsRemaining = Math.max(0, shift.capacity - confirmedCount);
  const isPast = new Date(shift.end) < new Date();
  const spotsLine = isPast
    ? "This shift has finished."
    : spotsRemaining === 0
      ? "Currently full — join the waitlist."
      : `${spotsRemaining} ${spotsRemaining === 1 ? "spot" : "spots"} still open.`;

  const description = `Volunteer with Everybody Eats: ${shift.shiftType.name} on ${dayLabel}, ${timeLabel}${locationPart}. ${spotsLine}`;

  return buildPageMetadata({
    title,
    description,
    path: `/shifts/${id}`,
    noIndex: isPast,
    useFileBasedOgImage: true,
  });
}

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

  const locationAddresses = await getLocationAddresses();

  // Parallelize all remaining queries
  const [friendships, userSignup, currentUser, concurrentShifts, cmsEvents] =
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

      // Marketing CMS events at this restaurant on the shift's day
      getCmsEventsForShift(shift.location, shift.start),
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

  const capacityPct =
    shift.capacity > 0
      ? Math.min(100, Math.round((confirmedCount / shift.capacity) * 100))
      : 0;

  const mapsQuery = shift.location
    ? `Everybody Eats ${
        locationAddresses[shift.location as Location] || shift.location
      }`
    : "";
  const mapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    mapsQuery
  )}`;
  const mapsEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    mapsQuery
  )}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  const statusLabel = isPastShift
    ? "Past shift"
    : isWaitlist
      ? "Waitlist only"
      : `${spotsRemaining} ${spotsRemaining === 1 ? "spot" : "spots"} left`;
  const statusChipClass = isPastShift
    ? "border-cream-50/15 bg-cream-50/10 text-cream-50/70"
    : isWaitlist
      ? "border-amber-200/30 bg-amber-300/15 text-amber-100"
      : "border-transparent bg-sun-200 text-forest-700";

  const calendarUrls = generateCalendarUrls(shift, locationAddresses);

  return (
    <PageContainer className="space-y-6">
      {/* Back link */}
      <Link
        href={`/shifts/details?date=${formatInNZT(
          new Date(shift.start),
          "yyyy-MM-dd"
        )}${
          shift.location
            ? `&location=${encodeURIComponent(shift.location)}`
            : ""
        }`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700/70 transition-colors hover:text-forest-500 dark:text-cream-50/70 dark:hover:text-cream-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to shifts
      </Link>

      {/* ============ Hero ============ */}
      <section className="grain relative overflow-hidden rounded-[2.5rem] bg-forest-700 px-7 py-10 text-cream-50 sm:px-12 sm:py-14">
        <Image
          src="/patterns/kawakawa.avif"
          alt=""
          width={416}
          height={416}
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 w-72 opacity-20 sm:w-96"
        />
        <div className="relative">
          <p className="eyebrow mb-6 flex items-center gap-3 text-sun-200/90">
            <span className="inline-block h-px w-8 bg-sun-200/50" />
            Volunteer shift{shift.location ? ` · ${shift.location}` : ""}
          </p>
          <div className="flex items-start gap-5">
            <div className="relative hidden shrink-0 sm:block">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cream-50/10 text-3xl ring-1 ring-cream-50/15">
                {theme.emoji}
              </div>
              <Sparkle className="absolute -right-2.5 -top-2.5 h-5 w-5 text-sun-200" />
            </div>
            <div className="min-w-0">
              <h1 className="display text-4xl leading-[1.04] tracking-tight sm:text-5xl">
                {shift.shiftType.name}
              </h1>
              {getShiftDescription(shift.notes, shift.shiftType.description) && (
                <p className="mt-3 max-w-xl leading-relaxed text-cream-50/80">
                  {getShiftDescription(shift.notes, shift.shiftType.description)}
                </p>
              )}
            </div>
          </div>

          {/* Fact chips */}
          <div className="mt-8 flex flex-wrap items-center gap-2.5">
            {[
              { icon: CalendarDays, label: shiftDate },
              { icon: Clock, label: shiftTime },
              {
                icon: Timer,
                label: `${duration} ${duration === 1 ? "hour" : "hours"}`,
              },
            ].map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border border-cream-50/15 bg-cream-50/10 px-3.5 py-1.5 text-sm text-cream-50/90"
              >
                <f.icon className="h-3.5 w-3.5 text-sun-200" />
                {f.label}
              </span>
            ))}
            <span
              className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium ${statusChipClass}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      </section>

      {/* ============ Body ============ */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-7">
          {/* Location */}
          {shift.location && (
            <div className="grain overflow-hidden rounded-3xl border border-forest-500/10 bg-card dark:border-cream-50/10">
              <div className="flex items-start justify-between gap-4 p-6 sm:p-7">
                <div className="min-w-0 space-y-1">
                  <p className="eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
                    <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
                    Where
                  </p>
                  <p className="display text-xl tracking-tight text-forest-700 dark:text-cream-50">
                    {shift.location}
                  </p>
                  <a
                    href={mapsSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-forest-700/65 underline-offset-4 transition-colors hover:text-forest-500 hover:underline dark:text-cream-50/60 dark:hover:text-cream-50"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {locationAddresses[shift.location as Location] ||
                      shift.location}
                  </a>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={mapsSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get directions
                  </a>
                </Button>
              </div>
              <div className="h-56 w-full border-t border-forest-500/10 dark:border-cream-50/10">
                <iframe
                  title="Shift location map"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={mapsEmbedUrl}
                />
              </div>
            </div>
          )}

          {/* Special events on this day, from the marketing CMS */}
          {cmsEvents.length > 0 && (
            <div className="space-y-3" data-testid="shift-cms-events">
              <p className="eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
                <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
                Special event at {shift.location} on this day
              </p>
              {cmsEvents.map((event) => (
                <div
                  key={event.id}
                  className="grain overflow-hidden rounded-3xl border border-forest-500/10 bg-card sm:flex dark:border-cream-50/10"
                >
                  {event.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.imageUrl}
                      alt={event.name}
                      className="h-40 w-full object-cover sm:h-auto sm:w-44 sm:shrink-0"
                    />
                  )}
                  <div className="space-y-1.5 p-6 sm:p-7">
                    <p className="display text-xl tracking-tight text-forest-700 dark:text-cream-50">
                      {event.name}
                    </p>
                    <p className="inline-flex items-center gap-1.5 text-sm text-forest-700/65 dark:text-cream-50/60">
                      <Ticket className="h-3.5 w-3.5 text-forest-500 dark:text-cream-50/70" />
                      {event.displayTime ??
                        formatInNZT(new Date(event.date), "h:mma").toLowerCase()}
                      {event.priceLabel ? ` · ${event.priceLabel}` : ""}
                    </p>
                    {event.shortDescription && (
                      <p className="text-sm leading-relaxed text-forest-700/70 dark:text-cream-50/65">
                        {event.shortDescription}
                      </p>
                    )}
                    <div className="pt-1.5">
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Details &amp; tickets
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Who's coming */}
          {(friendSignups.length > 0 || otherVolunteersCount > 0) && (
            <div className="grain rounded-3xl border border-forest-500/10 bg-card p-6 sm:p-7 dark:border-cream-50/10">
              <p className="eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
                <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
                Who&apos;s coming
              </p>
              <h3 className="mt-1 display text-xl tracking-tight text-forest-700 dark:text-cream-50">
                {friendSignups.length > 0
                  ? `${friendSignups.length} friend${
                      friendSignups.length !== 1 ? "s" : ""
                    } joining`
                  : "Your volunteering whānau"}
              </h3>
              <div className="mt-4">
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
            </div>
          )}

          {/* Calendar + share */}
          {!isPastShift && (
            <div className="grain rounded-3xl border border-forest-500/10 bg-card p-6 sm:p-7 dark:border-cream-50/10">
              <p className="eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
                <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
                Don&apos;t miss it
              </p>
              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-sm font-medium text-forest-700/75 dark:text-cream-50/70">
                    Add to calendar
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" asChild>
                      <a
                        href={calendarUrls.google}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Google
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" asChild>
                      <a
                        href={calendarUrls.outlook}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Outlook
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" asChild>
                      <a href={calendarUrls.ics} download={`shift-${shift.id}.ics`}>
                        <CalendarPlus className="h-3.5 w-3.5" />
                        .ics
                      </a>
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium text-forest-700/75 dark:text-cream-50/70">
                    Spread the word
                  </div>
                  <ShareShiftButton
                    url={`${getBaseUrl()}/shifts/${shift.id}`}
                    title={`Volunteer with Everybody Eats — ${shift.shiftType.name}`}
                    text={`Kia ora! Come volunteer on ${shiftDate}, ${shiftTime}${
                      shift.location ? ` at ${shift.location}` : ""
                    }.`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Signup sidebar */}
        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <div className="grain rounded-3xl border border-forest-500/10 bg-card p-6 sm:p-8 dark:border-cream-50/10">
              <p className="eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
                <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
                Your spot
              </p>

              {/* Capacity */}
              <div className="mt-4 flex items-baseline gap-2">
                <span className="display text-5xl tracking-tight tabular-nums text-forest-700 dark:text-cream-50">
                  {isPastShift ? "—" : isWaitlist ? "Full" : spotsRemaining}
                </span>
                {!isPastShift && !isWaitlist && (
                  <span className="text-sm text-forest-700/60 dark:text-cream-50/55">
                    {spotsRemaining === 1 ? "spot left" : "spots left"}
                  </span>
                )}
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-forest-500/10 dark:bg-cream-50/10">
                <div
                  className="h-full rounded-full bg-forest-500 dark:bg-forest-400"
                  style={{ width: `${capacityPct}%` }}
                />
              </div>
              <p className="mt-2 text-sm tabular-nums text-forest-700/60 dark:text-cream-50/55">
                {confirmedCount} of {shift.capacity} volunteers signed up
              </p>

              {/* Signed-up confirmation */}
              {isAlreadySignedUp && !isPastShift && (
                <div className="mt-5 flex items-center gap-2 rounded-2xl border border-forest-500/15 bg-forest-500/[0.07] p-4 dark:border-cream-50/10 dark:bg-cream-50/5">
                  <UserCheck className="h-5 w-5 shrink-0 text-forest-500 dark:text-forest-300" />
                  <span className="font-medium text-forest-700 dark:text-cream-50">
                    You&apos;re signed up for this shift!
                  </span>
                </div>
              )}

              {/* Volunteers-needed nudge */}
              {!isPastShift && !userSignup && spotsRemaining > 3 && (
                <p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-forest-700/75 dark:text-cream-50/70">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-forest-500 dark:text-cream-50/60" />
                  <span>
                    <strong className="font-semibold text-forest-700 dark:text-cream-50">
                      Volunteers needed!
                    </strong>{" "}
                    We still need {spotsRemaining} more for this shift.
                  </span>
                </p>
              )}

              {/* Actions */}
              <div className="mt-5 space-y-2">
                {isLoggedOut && (
                  <>
                    <Button asChild className="w-full">
                      <Link href={`/login?callbackUrl=/shifts/${id}`}>
                        Sign in to sign up
                      </Link>
                    </Button>
                    <p className="text-center text-sm text-forest-700/55 dark:text-cream-50/55">
                      You&apos;ll need an account to join this shift.
                    </p>
                  </>
                )}

                {isPastShift && !isLoggedOut && (
                  <Button disabled variant="secondary" className="w-full">
                    Shift has ended
                  </Button>
                )}

                {isAlreadySignedUp && !isPastShift && (
                  <CancelSignupButton
                    shiftId={id}
                    shiftName={shift.shiftType.name}
                    className="w-full"
                  />
                )}

                {!canSignUp &&
                  !isLoggedOut &&
                  !isPastShift &&
                  !isAlreadySignedUp &&
                  hasConflictingSignup && (
                    <Button disabled variant="secondary" className="w-full">
                      Already signed up for this{" "}
                      {isAMShift(shift.start) ? "AM" : "PM"} period
                    </Button>
                  )}

                {!canSignUp &&
                  !isLoggedOut &&
                  !isPastShift &&
                  !isAlreadySignedUp &&
                  !hasConflictingSignup &&
                  needsParentalConsent && (
                    <div className="w-full space-y-2">
                      <Button disabled variant="secondary" className="w-full">
                        Parental Consent Required
                      </Button>
                      <p className="text-sm text-forest-700/65 dark:text-cream-50/60">
                        Please download the consent form from your dashboard,
                        have your parent/guardian sign it, and email it to{" "}
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
                      <Button disabled variant="secondary" className="w-full">
                        Complete Profile Required
                      </Button>
                      <p className="text-sm text-forest-700/65 dark:text-cream-50/60">
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
                <div className="mt-4">
                  <Suspense fallback={null}>
                    <ProfileCompletionBannerServer />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildShiftEventSchema({
              id: shift.id,
              name: shift.shiftType.name,
              description: getShiftDescription(
                shift.notes,
                shift.shiftType.description
              ),
              startDate: new Date(shift.start),
              endDate: new Date(shift.end),
              location: shift.location,
              locationAddress: shift.location
                ? locationAddresses[shift.location]
                : undefined,
              capacity: shift.capacity,
              spotsAvailable: spotsRemaining,
            })
          ),
        }}
      />
    </PageContainer>
  );
}

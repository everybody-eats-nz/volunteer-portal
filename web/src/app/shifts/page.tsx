import { prisma } from "@/lib/prisma";
import {
  getShiftEffectiveCount,
  shiftCapacityCountSelect,
  SPOT_TAKING_STATUSES,
} from "@/lib/placeholder-utils";
import { resolveInitialCalendarMonth } from "@/lib/shift-calendar-month";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { safeParseAvailability } from "@/lib/parse-availability";
import { ShiftsCalendar } from "@/components/shifts-calendar";
import { LocationSwitcher } from "@/components/location-switcher";
import { getGoogleMapsUrl } from "@/lib/locations";
import { getLiveLocations } from "@/lib/live-locations";
import { Badge } from "@/components/ui/badge";
import { ShiftsProfileCompletionBanner } from "@/components/shifts-profile-completion-banner";
import { Suspense } from "react";
import { getAuthInfo } from "@/lib/auth-utils";
import { LocationAddress } from "@/components/location-address";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import {
  captureFunnelEvent,
  FunnelEvent,
  getPhidFromCookies,
} from "@/lib/funnel";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const location = Array.isArray(params.location)
    ? params.location[0]
    : params.location;
  const showAll = params.showAll === "true";

  let title = "Browse Volunteer Shifts";
  let description =
    "Explore available volunteer opportunities at Everybody Eats. From prep work to service, find shifts that fit your schedule.";
  let path = "/shifts";

  const liveLocations = await getLiveLocations();
  if (location && liveLocations.some((l) => l.name === location)) {
    title = `Volunteer Shifts in ${location}`;
    description = `Browse upcoming volunteer shifts at Everybody Eats ${location}. From prep work to service, find opportunities that fit your schedule.`;
    path = `/shifts?location=${encodeURIComponent(location)}`;
  } else if (showAll) {
    title = "All Volunteer Shifts";
    description =
      "Browse all upcoming volunteer shifts across all Everybody Eats locations in New Zealand.";
  }

  return buildPageMetadata({
    title,
    description,
    path,
  });
}

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

const eyebrowLight =
  "eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60";

interface ShiftSummary {
  id: string;
  start: Date;
  end: Date;
  location: string | null;
  capacity: number;
  confirmedCount: number;
  pendingCount: number;
  shiftType: {
    name: string;
    description: string | null;
  };
  friendSignups?: Array<{
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      email: string;
      profilePhotoUrl: string | null;
    };
    isFriend: boolean;
  }>;
}

export default async function ShiftsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, isLoggedIn } = await getAuthInfo();
  const params = await searchParams;
  const phid = await getPhidFromCookies();
  captureFunnelEvent({
    event: FunnelEvent.SHIFTS_BROWSED,
    userId: (user as { id?: string } | null)?.id ?? null,
    phid,
  });

  // Get current user — a single small lookup that drives the branch decision
  // (preferred / default locations).
  let currentUser = null;
  let userFriendIds: string[] = [];
  if (user?.email) {
    currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true, availableLocations: true, defaultLocation: true },
    });

    // Friend IDs drive which volunteers show as friends on the calendar
    if (currentUser?.id) {
      userFriendIds = await prisma.friendship
        .findMany({
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
        })
        .then((friendships) =>
          friendships.map((friendship) =>
            friendship.userId === currentUser!.id
              ? friendship.friendId
              : friendship.userId
          )
        );
    }
  }

  // Parse user's preferred locations (still used for admin targeting and other features)
  const userPreferredLocations = safeParseAvailability(
    currentUser?.availableLocations
  );

  // Explicit default location set by the user in their profile
  const userDefaultLocation = currentUser?.defaultLocation ?? null;

  // Locations volunteers can browse right now: live (has upcoming shifts) and
  // not disabled. Locations created ahead of their shifts stay hidden here.
  const liveLocations = await getLiveLocations();
  const liveLocationNames = liveLocations.map((l) => l.name);
  const addressByName = new Map(
    liveLocations.map((l) => [l.name, l.address] as const)
  );

  // Handle location filtering
  const rawLocation = Array.isArray(params.location)
    ? params.location[0]
    : params.location;
  let selectedLocation: string | undefined =
    rawLocation && liveLocationNames.includes(rawLocation)
      ? rawLocation
      : undefined;

  const showAll = params.showAll === "true";
  const chooseLocation = params.chooseLocation === "true";

  // Determine filter locations
  let filterLocations: string[] = [];
  let hasExplicitLocationChoice = false;

  if (selectedLocation) {
    filterLocations = [selectedLocation];
    hasExplicitLocationChoice = true;
  } else if (showAll) {
    filterLocations = [];
    hasExplicitLocationChoice = true;
  } else if (
    userDefaultLocation &&
    liveLocationNames.includes(userDefaultLocation) &&
    !chooseLocation
  ) {
    // Auto-filter to the user's explicit default location unless they've
    // requested to choose one manually.
    filterLocations = [userDefaultLocation];
    selectedLocation = userDefaultLocation;
    hasExplicitLocationChoice = true;
  }

  // Single server-side timestamp, reused for the shift query and seeded into
  // the calendar so SSR and client hydration agree on "now" (see ShiftsCalendar).
  const now = new Date();

  // Fetch shifts for calendar view - simplified data structure
  const shifts = await prisma.shift.findMany({
    where: {
      start: { gte: now },
      ...(filterLocations.length > 0
        ? { location: { in: filterLocations } }
        : {}),
    },
    orderBy: { start: "asc" },
    include: {
      shiftType: {
        select: {
          name: true,
          description: true,
        },
      },
      _count: shiftCapacityCountSelect(SPOT_TAKING_STATUSES),
    },
  });

  // Fetch all signups and filter by privacy settings
  type FriendSignup = {
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      email: string;
      profilePhotoUrl: string | null;
    };
    isFriend: boolean;
  };
  let friendSignupsMap: Record<string, FriendSignup[]> = {};

  // Only fetch signups if user is logged in
  if (currentUser?.id) {
    const allSignups = await prisma.signup.findMany({
      where: {
        shiftId: { in: shifts.map((s) => s.id) },
        // Confirmed only, matching the capacity figures: an unapproved request
        // shouldn't show on the calendar as someone who is coming.
        status: { in: [...SPOT_TAKING_STATUSES] },
        // Exclude the current user from the list
        userId: { not: currentUser.id },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePhotoUrl: true,
            friendVisibility: true,
          },
        },
      },
    });

    // Filter by privacy settings and group by shift ID
    friendSignupsMap = allSignups
      .filter((signup) => {
        const { friendVisibility } = signup.user;

        // PUBLIC: Show to everyone who is logged in
        if (friendVisibility === "PUBLIC") {
          return true;
        }

        // FRIENDS_ONLY: Only show to friends
        if (friendVisibility === "FRIENDS_ONLY") {
          return userFriendIds.includes(signup.user.id);
        }

        // PRIVATE: Don't show to anyone
        return false;
      })
      .reduce<Record<string, FriendSignup[]>>((acc, signup) => {
        if (!acc[signup.shiftId]) acc[signup.shiftId] = [];
        acc[signup.shiftId].push({
          user: signup.user,
          isFriend: userFriendIds.includes(signup.user.id),
        });
        return acc;
      }, {});
  }

  // Transform to ShiftSummary format for calendar
  const shiftSummaries: ShiftSummary[] = shifts.map((shift) => ({
    id: shift.id,
    start: shift.start,
    end: shift.end,
    location: shift.location,
    capacity: shift.capacity,
    // Confirmed signups + unregistered walk-ins. Pending requests are
    // deliberately excluded so a manager holding requests never makes a shift
    // look full to volunteers.
    confirmedCount: getShiftEffectiveCount(shift),
    pendingCount: 0, // Calendar totals live entirely in confirmedCount
    shiftType: {
      name: shift.shiftType.name,
      description: shift.shiftType.description,
    },
    friendSignups: friendSignupsMap[shift.id] || [],
  }));

  // Resolved server-side so SSR and hydration agree regardless of the viewer's
  // timezone (see the helper for why it can differ from the current month).
  const initialMonth = resolveInitialCalendarMonth(
    shiftSummaries.map((shift) => shift.start),
    now
  );

  // If no explicit location choice has been made, show location selection screen
  if (!hasExplicitLocationChoice) {
    return (
      <PageContainer testid="shifts-location-selection">
        <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center py-10 text-center sm:py-16">
          {/* ============ Hero ============ */}
          <div className="flex flex-col items-center">
            <p className={`${eyebrowLight} mb-6 justify-center`}>
              <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
              Kia ora · Where to, whānau?
              <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
            </p>
            <div className="relative mb-6">
              <span className="grain flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-500 text-cream-50 shadow-lg dark:bg-forest-600">
                <MapPin className="h-8 w-8" />
              </span>
              <Sparkle className="absolute -right-3 -top-3 h-6 w-6 text-sun-300 drop-shadow" />
            </div>
            <h1
              className="display text-4xl leading-[1.02] tracking-tight text-forest-700 sm:text-5xl dark:text-cream-50"
              data-testid="location-selection-title"
            >
              Choose Your <em>Location</em>
            </h1>
            <p
              className="mt-4 max-w-md text-lg leading-relaxed text-forest-700/75 dark:text-cream-50/75"
              data-testid="location-selection-description"
            >
              Please select a location to view available volunteer shifts
            </p>
          </div>

          {/* ============ Location options ============ */}
          <div
            className="mt-10 w-full space-y-6 text-left"
            data-testid="location-selection-options"
          >
            {/* User's preferred locations (if any) */}
            {userPreferredLocations.length > 1 && (
              <div className="space-y-3">
                <p className={eyebrowLight}>
                  <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
                  Your preferred spots
                </p>
                <div className="grid gap-3">
                  {userPreferredLocations.map(
                    (loc) =>
                      liveLocationNames.includes(loc) && (
                        <Link
                          key={loc}
                          href={`/shifts?location=${loc}`}
                          className="grain group flex items-center justify-between gap-4 rounded-2xl border border-forest-500/15 bg-sun-100/60 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-forest-500/30 hover:shadow-lg dark:border-cream-50/10 dark:bg-sun-200/10"
                          data-testid={`preferred-location-${loc
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-500 text-cream-50 dark:bg-forest-600">
                              <MapPin className="h-5 w-5" />
                            </span>
                            <div>
                              <span className="font-medium text-forest-700 dark:text-cream-50">
                                {loc}
                              </span>
                              {addressByName.get(loc) && (
                                <LocationAddress
                                  address={addressByName.get(loc)!}
                                />
                              )}
                            </div>
                          </div>
                          <span className="text-forest-500 transition-transform duration-200 group-hover:translate-x-1 dark:text-cream-50/80">
                            →
                          </span>
                        </Link>
                      )
                  )}
                </div>
              </div>
            )}

            {/* All locations */}
            <div className="space-y-3">
              {userPreferredLocations.length > 1 && (
                <p className={eyebrowLight}>
                  <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
                  Other locations
                </p>
              )}
              <div className="grid gap-3">
                {liveLocations
                  .filter((loc) =>
                    userPreferredLocations.length > 1
                      ? !userPreferredLocations.includes(loc.name)
                      : true
                  )
                  .map((loc) => (
                    <Link
                      key={loc.name}
                      href={`/shifts?location=${loc.name}`}
                      className="grain group flex items-center justify-between gap-4 rounded-2xl border border-forest-500/15 bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-forest-500/30 hover:shadow-lg dark:border-cream-50/10"
                      data-testid={`location-option-${loc.name
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-500/10 text-forest-500 transition-colors group-hover:bg-forest-500 group-hover:text-cream-50 dark:bg-cream-50/10 dark:text-cream-50/80">
                          <MapPin className="h-5 w-5" />
                        </span>
                        <div>
                          <span className="flex items-center gap-2 font-medium text-forest-700 dark:text-cream-50">
                            {loc.name}
                            {loc.isNew && (
                              <Badge
                                className="h-5 px-1.5 text-[10px] uppercase tracking-wide"
                                data-testid={`location-new-badge-${loc.name
                                  .toLowerCase()
                                  .replace(/\s+/g, "-")}`}
                              >
                                New
                              </Badge>
                            )}
                          </span>
                          {loc.address && (
                            <LocationAddress address={loc.address} />
                          )}
                        </div>
                      </div>
                      <span className="text-forest-500/60 transition-all duration-200 group-hover:translate-x-1 group-hover:text-forest-500 dark:text-cream-50/50">
                        →
                      </span>
                    </Link>
                  ))}

                {/* Show all locations option */}
                <Link
                  href="/shifts?showAll=true"
                  className="group flex items-center justify-between gap-4 rounded-2xl border border-dashed border-forest-500/25 bg-transparent p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-forest-500/45 hover:bg-forest-500/5 dark:border-cream-50/20 dark:hover:bg-cream-50/5"
                  data-testid="show-all-locations"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-forest-500/30 text-forest-500/70 dark:border-cream-50/25 dark:text-cream-50/60">
                      <Sparkle className="h-4 w-4" />
                    </span>
                    <span className="font-medium text-forest-700 dark:text-cream-50">
                      All Locations
                    </span>
                  </div>
                  <span className="text-forest-500/60 transition-all duration-200 group-hover:translate-x-1 group-hover:text-forest-500 dark:text-cream-50/50">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* Help text */}
          {userPreferredLocations.length === 0 && isLoggedIn && (
            <div className="mt-8 max-w-lg text-sm text-forest-700/65 dark:text-cream-50/60">
              <p>
                <Link
                  href="/profile/edit"
                  className="font-medium text-forest-500 underline-offset-4 hover:underline dark:text-cream-50/85"
                >
                  Set your preferred locations
                </Link>{" "}
                to customise your experience.
              </p>
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  return (
    <>
      <PageContainer testid="shifts-browse-page">
        {/* The display heading doubles as the location switcher — the marketing
            title itself opens the location menu (styled to match, below). */}
        <div className="pb-2">
          <p className={`${eyebrowLight} mb-4`}>
            <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
            Browse volunteer shifts
          </p>
          <h1
            className="display text-4xl italic leading-[1.0] tracking-tight text-forest-700 sm:text-5xl lg:text-6xl dark:text-cream-50"
            data-testid="shifts-page-header"
          >
            <LocationSwitcher
              locations={liveLocations.map(({ name, isNew }) => ({
                name,
                isNew,
              }))}
              selectedLocation={selectedLocation}
              showAll={showAll}
              isLoggedIn={isLoggedIn}
              userDefaultLocation={userDefaultLocation}
            />
          </h1>
          {selectedLocation && addressByName.get(selectedLocation) && (
            <div
              className="mt-4 flex items-start gap-2 text-sm text-forest-700/70 dark:text-cream-50/70"
              data-testid="restaurant-address-banner"
            >
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-forest-500 dark:text-cream-50/70" />
              <a
                href={getGoogleMapsUrl(addressByName.get(selectedLocation)!)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="restaurant-address"
                className="text-left underline-offset-4 hover:text-forest-500 hover:underline dark:hover:text-cream-50"
              >
                {addressByName.get(selectedLocation)}
              </a>
            </div>
          )}
        </div>

        {/* Profile completion banner - shows if profile incomplete */}
        <Suspense fallback={null}>
          <ShiftsProfileCompletionBanner />
        </Suspense>

        {/* Calendar View */}
        <ShiftsCalendar
          shifts={shiftSummaries}
          selectedLocation={selectedLocation}
          serverNow={now.getTime()}
          initialMonth={initialMonth}
        />
      </PageContainer>
    </>
  );
}

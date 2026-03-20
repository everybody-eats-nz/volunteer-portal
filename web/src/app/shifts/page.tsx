import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MapPin, ChevronRight, Calendar } from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { safeParseAvailability } from "@/lib/parse-availability";
import { ShiftsCalendar } from "@/components/shifts-calendar";
import {
  LocationOption,
  LOCATION_ADDRESSES,
  Location,
  getLocationMapsUrl,
  LOCATIONS,
} from "@/lib/locations";
import { ShiftsProfileCompletionBanner } from "@/components/shifts-profile-completion-banner";
import { Suspense } from "react";
import { getAuthInfo } from "@/lib/auth-utils";
import { LocationAddress } from "@/components/location-address";
import type { Metadata } from "next";
import { buildPageMetadata, buildShiftEventSchema } from "@/lib/seo";

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

  if (location && LOCATIONS.includes(location as LocationOption)) {
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

  // Get current user
  let currentUser = null;
  let userFriendIds: string[] = [];
  if (user?.email) {
    currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true, availableLocations: true },
    });

    // Get user's friend IDs if logged in
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

  // Fetch a
  // Parse user's preferred locations
  const userPreferredLocations = safeParseAvailability(
    currentUser?.availableLocations
  );

  // Filter out special event venue from auto-default logic
  // Special events shouldn't be auto-selected as the default location
  const userPreferredLocationsForDefault = userPreferredLocations.filter(
    (loc: string) => loc !== "Special Event Venue"
  );

  // Handle location filtering
  const rawLocation = Array.isArray(params.location)
    ? params.location[0]
    : params.location;
  let selectedLocation: LocationOption | undefined = LOCATIONS.includes(
    (rawLocation as LocationOption) ?? ("" as LocationOption)
  )
    ? (rawLocation as LocationOption)
    : undefined;

  const showAll = params.showAll === "true";
  const chooseLocation = params.chooseLocation === "true";

  // Determine filter locations
  let filterLocations: string[] = [];
  let isUsingProfileFilter = false;
  let hasExplicitLocationChoice = false;

  if (selectedLocation) {
    filterLocations = [selectedLocation];
    hasExplicitLocationChoice = true;
  } else if (showAll) {
    filterLocations = [];
    hasExplicitLocationChoice = true;
  } else if (userPreferredLocationsForDefault.length > 0 && !chooseLocation) {
    // Only auto-filter by profile preferences if there's only one preferred location
    // (excluding special event venues) and user hasn't explicitly requested to choose a location
    // Otherwise, force explicit selection to avoid confusion
    if (userPreferredLocationsForDefault.length === 1) {
      filterLocations = userPreferredLocationsForDefault.filter((loc: string) =>
        LOCATIONS.includes(loc as LocationOption)
      );
      // Set selectedLocation for address display
      selectedLocation = filterLocations[0] as LocationOption;
      isUsingProfileFilter = true;
      hasExplicitLocationChoice = true;
    }
  }

  // Fetch shifts for calendar view - simplified data structure
  const shifts = await prisma.shift.findMany({
    where: {
      start: { gte: new Date() },
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
      _count: {
        select: {
          signups: {
            where: {
              status: {
                in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"],
              },
            },
          },
        },
      },
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
        status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
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
    confirmedCount: shift._count.signups + shift.placeholderCount, // Includes CONFIRMED, PENDING, REGULAR_PENDING + placeholders
    pendingCount: 0, // For calendar view, we simplify by putting all counts in confirmedCount
    shiftType: {
      name: shift.shiftType.name,
      description: shift.shiftType.description,
    },
    friendSignups: friendSignupsMap[shift.id] || [],
  }));

  // If no explicit location choice has been made, show location selection screen
  if (!hasExplicitLocationChoice) {
    return (
      <PageContainer testid="shifts-location-selection">
        <div className="max-w-2xl mx-auto py-8 sm:py-16">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-12 h-12 mx-auto mb-5 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              data-testid="location-selection-title"
            >
              Where would you like to volunteer?
            </h1>
            <p
              className="text-muted-foreground mt-2 text-base sm:text-lg"
              data-testid="location-selection-description"
            >
              Select a location to see available shifts
            </p>
          </div>

          <div
            className="space-y-6"
            data-testid="location-selection-options"
          >
            {/* User's preferred locations (if any) */}
            {userPreferredLocations.length > 1 && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Your preferred locations
                </p>
                <div className="grid gap-2">
                  {userPreferredLocations.map(
                    (loc) =>
                      LOCATIONS.includes(loc as LocationOption) && (
                        <Link
                          key={loc}
                          href={`/shifts?location=${loc}`}
                          className="flex items-center gap-4 p-4 bg-primary/[0.04] hover:bg-primary/[0.08] border border-primary/15 hover:border-primary/25 rounded-xl transition-all duration-200 group text-left"
                          data-testid={`preferred-location-${loc
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                            <MapPin className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-foreground block">{loc}</span>
                            {LOCATION_ADDRESSES[loc as Location] && (
                              <LocationAddress
                                address={LOCATION_ADDRESSES[loc as Location]}
                              />
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
                        </Link>
                      )
                  )}
                </div>
              </div>
            )}

            {/* All locations */}
            <div className="space-y-3">
              {userPreferredLocations.length > 1 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Other locations
                </p>
              )}
              <div className="grid gap-2">
                {LOCATIONS.filter((loc) =>
                  userPreferredLocations.length > 1
                    ? !userPreferredLocations.includes(loc)
                    : true
                ).map((loc) => (
                  <Link
                    key={loc}
                    href={`/shifts?location=${loc}`}
                    className="flex items-center gap-4 p-4 bg-background hover:bg-muted/60 border border-border hover:border-border/80 rounded-xl transition-all duration-200 group text-left"
                    data-testid={`location-option-${loc
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-muted/80 transition-colors">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-foreground block">{loc}</span>
                      {LOCATION_ADDRESSES[loc as Location] && (
                        <LocationAddress
                          address={LOCATION_ADDRESSES[loc as Location]}
                        />
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                  </Link>
                ))}

                {/* Show all locations option */}
                <Link
                  href="/shifts?showAll=true"
                  className="flex items-center gap-4 p-4 bg-muted/30 hover:bg-muted/50 border border-dashed border-border rounded-xl transition-all duration-200 group"
                  data-testid="show-all-locations"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold text-foreground block">All Locations</span>
                    <span className="text-sm text-muted-foreground">View shifts across all sites</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                </Link>
              </div>
            </div>
          </div>

          {/* Help text */}
          {userPreferredLocations.length === 0 && isLoggedIn && (
            <p className="text-sm text-muted-foreground text-center mt-8">
              <Link
                href="/profile/edit"
                className="underline underline-offset-4 hover:text-primary transition-colors"
              >
                Set your preferred locations
              </Link>{" "}
              in your profile to personalise this page.
            </p>
          )}
        </div>
      </PageContainer>
    );
  }

  // Generate Event schema for up to 20 shifts
  const shiftSchemas = shiftSummaries.slice(0, 20).map((shift) =>
    buildShiftEventSchema({
      id: shift.id,
      name: shift.shiftType.name,
      description: shift.shiftType.description,
      startDate: shift.start,
      endDate: shift.end,
      location: shift.location,
      capacity: shift.capacity,
      spotsAvailable: shift.capacity - shift.confirmedCount,
    })
  );

  return (
    <>
      {shiftSchemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <PageContainer testid="shifts-browse-page">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <PageHeader
            title={
              selectedLocation ||
              (showAll
                ? "All Locations"
                : isUsingProfileFilter
                ? userPreferredLocations.join(", ")
                : "Shifts")
            }
            description={
              (selectedLocation &&
                LOCATION_ADDRESSES[selectedLocation as Location] && (
                  <div
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                    data-testid="restaurant-address-banner"
                  >
                    <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <a
                      href={getLocationMapsUrl(selectedLocation as Location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="restaurant-address"
                      className="text-left hover:text-primary hover:underline"
                    >
                      {LOCATION_ADDRESSES[selectedLocation as Location]}
                    </a>
                  </div>
                )) ||
              undefined
            }
            data-testid="shifts-page-header"
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
          {/* Back to locations button */}
          <Link
            href="/shifts?chooseLocation=true"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-primary/30 rounded-lg transition-colors"
            data-testid="back-to-locations-button"
          >
            ← Choose Different Location
          </Link>
        </div>
      </div>

      {/* Profile completion banner - shows if profile incomplete */}
      <Suspense fallback={null}>
        <ShiftsProfileCompletionBanner />
      </Suspense>

      {/* Calendar View */}
      <ShiftsCalendar
        shifts={shiftSummaries}
        selectedLocation={selectedLocation}
      />
    </PageContainer>
    </>
  );
}

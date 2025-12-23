import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { MapPin } from "lucide-react";
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

  if (location && LOCATIONS.includes(location as LocationOption)) {
    title = `Volunteer Shifts in ${location}`;
    description = `Browse upcoming volunteer shifts at Everybody Eats ${location}. From prep work to service, find opportunities that fit your schedule.`;
  } else if (showAll) {
    title = "All Volunteer Shifts";
    description =
      "Browse all upcoming volunteer shifts across all Everybody Eats locations in New Zealand.";
  }

  return buildPageMetadata({
    title,
    description,
    path: "/shifts",
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
                in: ["CONFIRMED", "PENDING"],
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
        status: { in: ["CONFIRMED", "PENDING"] },
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
    confirmedCount: shift._count.signups, // This includes both CONFIRMED and PENDING
    pendingCount: 0, // For calendar view, we simplify this
    shiftType: {
      name: shift.shiftType.name,
      description: shift.shiftType.description,
    },
    friendSignups: friendSignupsMap[shift.id] || [],
  }));

  // If no explicit location choice has been made, show location selection screen
  if (!hasExplicitLocationChoice) {
    return (
      <PageContainer testid="shifts-browse-page">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
              <MapPin className="h-8 w-8" />
            </div>
            <div>
              <h1
                className="text-3xl font-bold tracking-tight mb-2"
                data-testid="location-selection-title"
              >
                Choose Your Location
              </h1>
              <p
                className="text-muted-foreground text-lg"
                data-testid="location-selection-description"
              >
                Please select a location to view available volunteer shifts
              </p>
            </div>
          </div>

          <div
            className="max-w-md w-full space-y-4"
            data-testid="location-selection-options"
          >
            {/* User's preferred locations (if any) */}
            {userPreferredLocations.length > 1 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Your preferred locations:
                </p>
                <div className="grid gap-3">
                  {userPreferredLocations.map(
                    (loc) =>
                      LOCATIONS.includes(loc as LocationOption) && (
                        <Link
                          key={loc}
                          href={`/shifts?location=${loc}`}
                          className="flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 hover:border-primary/30 rounded-lg transition-all duration-200 group text-left"
                          data-testid={`preferred-location-${loc
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-primary rounded-full"></div>
                            <div>
                              <span className="font-medium">{loc}</span>
                              {LOCATION_ADDRESSES[loc as Location] && (
                                <LocationAddress
                                  address={LOCATION_ADDRESSES[loc as Location]}
                                />
                              )}
                            </div>
                          </div>
                          <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            →
                          </div>
                        </Link>
                      )
                  )}
                </div>
              </div>
            )}

            {/* All locations */}
            <div className="space-y-3">
              {userPreferredLocations.length > 1 && (
                <p className="text-sm font-medium text-muted-foreground">
                  Other locations:
                </p>
              )}
              <div className="grid gap-3">
                {LOCATIONS.filter((loc) =>
                  userPreferredLocations.length > 1
                    ? !userPreferredLocations.includes(loc)
                    : true
                ).map((loc) => (
                  <Link
                    key={loc}
                    href={`/shifts?location=${loc}`}
                    className="flex items-center justify-between p-4 bg-background hover:bg-muted border border-border hover:border-primary/30 rounded-lg transition-all duration-200 group text-left"
                    data-testid={`location-option-${loc
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-muted-foreground rounded-full"></div>
                      <div>
                        <span className="font-medium">{loc}</span>
                        {LOCATION_ADDRESSES[loc as Location] && (
                          <LocationAddress
                            address={LOCATION_ADDRESSES[loc as Location]}
                          />
                        )}
                      </div>
                    </div>
                    <div className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </div>
                  </Link>
                ))}

                {/* Show all locations option */}
                <Link
                  href="/shifts?showAll=true"
                  className="flex items-center justify-between p-4 bg-muted/50 hover:bg-muted border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 rounded-lg transition-all duration-200 group"
                  data-testid="show-all-locations"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 border-2 border-muted-foreground rounded-full"></div>
                    <span className="font-medium">All Locations</span>
                  </div>
                  <div className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Help text */}
          {userPreferredLocations.length === 0 && isLoggedIn && (
            <div className="text-sm text-muted-foreground max-w-lg">
              <p className="mt-2">
                <Link
                  href="/profile/edit"
                  className="underline hover:text-primary"
                >
                  Set your preferred locations
                </Link>{" "}
                to customize your experience.
              </p>
            </div>
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

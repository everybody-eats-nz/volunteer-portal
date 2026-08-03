import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

import { LocationsContent } from "./locations-content";
import type { Venue, VenueManager } from "./types";

function managerDisplayName(user: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
}): string {
  if (user.name) return user.name;
  const joined = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return joined || user.email.split("@")[0];
}

function initialsOf(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export default async function LocationsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [locations, upcomingShiftGroups, restaurantManagers] =
    await Promise.all([
      prisma.location.findMany({ orderBy: { name: "asc" } }),
      // Shift.location is a free-text reference to Location.name, so shift
      // stats are grouped by name rather than joined by id.
      prisma.shift.groupBy({
        by: ["location"],
        where: { start: { gte: new Date() }, location: { not: null } },
        _count: { _all: true },
        _min: { start: true },
      }),
      prisma.restaurantManager.findMany({
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

  const shiftStatsByLocation = new Map(
    upcomingShiftGroups.map((group) => [
      group.location,
      { count: group._count._all, next: group._min.start },
    ])
  );

  const managersByLocation = new Map<string, VenueManager[]>();
  for (const manager of restaurantManagers) {
    const displayName = managerDisplayName(manager.user);
    for (const locationName of manager.locations) {
      const entry: VenueManager = {
        id: manager.id,
        name: displayName,
        initials: initialsOf(displayName),
        muted: !manager.receiveNotifications,
      };
      const existing = managersByLocation.get(locationName);
      if (existing) {
        existing.push(entry);
      } else {
        managersByLocation.set(locationName, [entry]);
      }
    }
  }

  const venues: Venue[] = locations.map((location) => {
    const shiftStats = shiftStatsByLocation.get(location.name);
    return {
      id: location.id,
      name: location.name,
      address: location.address,
      defaultMealsServed: location.defaultMealsServed,
      targetPerNight:
        location.targetPerNight === null
          ? null
          : Number(location.targetPerNight),
      isActive: location.isActive,
      isPopup: location.isPopup,
      upcomingShifts: shiftStats?.count ?? 0,
      nextServiceAt: shiftStats?.next?.toISOString() ?? null,
      managers: managersByLocation.get(location.name) ?? [],
    };
  });

  return <LocationsContent initialVenues={venues} />;
}

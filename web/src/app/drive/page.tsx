import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getFleetStatus, orgLabelOf, purposeLabelOf } from "@/lib/van/queries";
import { tripInclude } from "@/lib/van/trips";
import { firstNameOf, formatDay, formatKm, formatTime } from "@/lib/van/format";
import { DriverHome } from "@/components/van/driver-home";

export const metadata: Metadata = {
  title: "Van log",
  robots: { index: false, follow: false },
};

const DAY_MS = 86_400_000;

/** Hoisted out of the component body: the render must stay pure. */
function daysAgo(days: number): Date {
  return new Date(new Date().getTime() - days * DAY_MS);
}

/** The driver's home. When a trip is open, it is mostly one button. */
export default async function DrivePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/drive");
  const userId = session.user.id;

  const [profile, fleet, myTrips] = await Promise.all([
    prisma.driverProfile.findUnique({ where: { userId } }),
    getFleetStatus(),
    prisma.trip.findMany({
      where: { driverId: userId },
      include: tripInclude,
      orderBy: { startedAt: "desc" },
      take: 60,
    }),
  ]);

  const openTrip = myTrips.find((t) => t.status === "OPEN") ?? null;
  const closed = myTrips.filter((t) => t.status !== "OPEN");
  const thirtyDaysAgo = daysAgo(30);
  const recentKm = closed
    .filter((t) => t.startedAt >= thirtyDaysAgo)
    .reduce((sum, t) => sum + (t.distanceKm ?? 0), 0);

  // Group by NZ day. Trips are stored in UTC; the driver thinks in local days.
  const days: Array<{ key: string; label: string; trips: typeof closed }> = [];
  for (const trip of closed) {
    const key = formatDay(trip.startedAt);
    const existing = days.find((d) => d.key === key);
    if (existing) existing.trips.push(trip);
    else days.push({ key, label: key, trips: [trip] });
  }

  return (
    <DriverHome
      firstName={firstNameOf(session.user.name ?? session.user.email)}
      driverStatus={profile?.status ?? null}
      statusNote={profile?.statusNote ?? null}
      today={formatDay(new Date())}
      recentKmLabel={formatKm(recentKm)}
      fleet={fleet}
      viewerId={userId}
      openTrip={
        openTrip
          ? {
              id: openTrip.id,
              vehicleName: openTrip.vehicle.name,
              orgLabel: orgLabelOf(openTrip),
              purposeLabel: purposeLabelOf(openTrip),
              startedAt: openTrip.startedAt.toISOString(),
              startedAtLabel: formatTime(openTrip.startedAt),
            }
          : null
      }
      days={days.map((day) => ({
        key: day.key,
        label: day.label,
        trips: day.trips.map((trip) => ({
          id: trip.id,
          purposeLabel: purposeLabelOf(trip),
          subtitle: trip.organisation.isInternal
            ? `${trip.vehicle.name} · ${formatTime(trip.startedAt)}`
            : `${trip.vehicle.name} · ${orgLabelOf(trip)}`,
          distanceLabel: formatKm(trip.distanceKm ?? 0),
          flagged: trip.status === "FLAGGED",
        })),
      }))}
    />
  );
}

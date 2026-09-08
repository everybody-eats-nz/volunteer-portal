import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { lastChoiceFor } from "@/lib/van/trips";
import { firstNameOf } from "@/lib/van/format";
import {
  VanEntry,
  type DriverState,
} from "@/components/van/van-entry";

/**
 * The QR sticker's permanent home.
 *
 * A laminated sticker goes on each van's dashboard, so this URL has to stay
 * stable forever and stay dumb: it decides what to show from whether the van is
 * out, never from how the driver arrived. `mileage.everybodyeats.nz` points
 * here. The page is public — auth is only required by the *action*.
 */

export const metadata: Metadata = {
  title: "Van log",
  // A URL printed on a sticker is not a page anyone should reach via search.
  robots: { index: false, follow: false },
};

export default async function VanPage({
  params,
  searchParams,
}: {
  params: Promise<{ vanId: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { vanId } = await params;
  const { start } = await searchParams;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vanId },
    include: { ownerOrg: true },
  });
  if (!vehicle || !vehicle.isActive) notFound();

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  const [openTrip, organisations, purposes, driverProfile] = await Promise.all([
    prisma.trip.findFirst({
      where: { vehicleId: vehicle.id, status: "OPEN" },
      include: {
        driver: { select: { id: true, name: true, firstName: true } },
      },
    }),
    prisma.organisation.findMany({
      where: { isActive: true },
      orderBy: [{ isInternal: "desc" }, { name: "asc" }],
    }),
    prisma.tripPurpose.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    userId
      ? prisma.driverProfile.findUnique({ where: { userId } })
      : Promise.resolve(null),
  ]);

  const shortcutSource =
    userId && driverProfile?.status === "APPROVED"
      ? await lastChoiceFor(userId)
      : null;

  const driver: DriverState = !userId
    ? { kind: "anonymous" }
    : !driverProfile
      ? { kind: "not-registered" }
      : driverProfile.status === "APPROVED"
        ? {
            kind: "approved",
            firstName: firstNameOf(
              session?.user?.name ?? session?.user?.email ?? null
            ),
          }
        : driverProfile.status === "SUSPENDED"
          ? { kind: "suspended", note: driverProfile.statusNote }
          : { kind: "pending" };

  return (
    <VanEntry
      vehicle={{
        id: vehicle.id,
        name: vehicle.name,
        rego: vehicle.rego,
        currentOdo: vehicle.currentOdo,
      }}
      photoUrl={vehicle.photoUrl}
      homeCity={vehicle.homeCity}
      openTrip={
        openTrip
          ? {
              id: openTrip.id,
              holderFirstName: firstNameOf(
                openTrip.driver.firstName ?? openTrip.driver.name
              ),
              isMine: openTrip.driverId === userId,
              startedAt: openTrip.startedAt.toISOString(),
              startOdo: openTrip.startOdo,
            }
          : null
      }
      driver={driver}
      organisations={organisations.map((o) => ({
        id: o.id,
        name: o.name,
        isInternal: o.isInternal,
        isCatchAll: o.isCatchAll,
      }))}
      purposes={purposes.map((p) => ({
        id: p.id,
        label: p.label,
        requiresNote: p.requiresNote,
      }))}
      shortcut={
        shortcutSource
          ? {
              organisationId: shortcutSource.organisation.id,
              organisationName: shortcutSource.organisation.name,
              purposeId: shortcutSource.purpose.id,
              purposeLabel: shortcutSource.purpose.label,
            }
          : null
      }
      autoStart={start === "1"}
    />
  );
}

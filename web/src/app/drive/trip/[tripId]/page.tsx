import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Metadata } from "next";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { tripInclude } from "@/lib/van/trips";
import { toTripScreen } from "@/lib/van/queries";
import { TripScreen } from "@/components/van/trip-screen";

export const metadata: Metadata = {
  title: "Trip",
  robots: { index: false, follow: false },
};

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ started?: string }>;
}) {
  const [{ tripId }, { started }, session] = await Promise.all([
    params,
    searchParams,
    getServerSession(authOptions),
  ]);

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/drive/trip/${tripId}`);
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: tripInclude,
  });
  if (!trip) notFound();

  const isAdmin = session.user.role === "ADMIN";
  // A driver sees their own trips. Admins see any, because chasing down a bad
  // reading is the whole job of the exceptions list.
  if (trip.driverId !== session.user.id && !isAdmin) notFound();

  return (
    <TripScreen
      trip={toTripScreen(trip, session.user.id, isAdmin)}
      justStarted={started === "1"}
    />
  );
}

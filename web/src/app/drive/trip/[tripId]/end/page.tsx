import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import type { Metadata } from "next";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { tripInclude } from "@/lib/van/trips";
import { purposeLabelOf } from "@/lib/van/queries";
import { formatKm } from "@/lib/van/format";
import { EndFlow } from "@/components/van/end-flow";
import { DriverScreen } from "@/components/van/van-chrome";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "End trip",
  robots: { index: false, follow: false },
};

export default async function EndTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/drive/trip/${tripId}/end`);
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: tripInclude,
  });
  if (!trip) notFound();

  const isAdmin = session.user.role === "ADMIN";
  if (trip.driverId !== session.user.id && !isAdmin) notFound();

  if (trip.status !== "OPEN") {
    return (
      <DriverScreen testid="van-trip-already-closed">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-semibold">This trip is already closed</h1>
          <p className="mt-2 text-muted-foreground">
            It was logged at {formatKm(trip.distanceKm ?? 0)}.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href={`/drive/trip/${trip.id}`}>See the trip</Link>
          </Button>
        </div>
      </DriverScreen>
    );
  }

  return (
    <EndFlow
      trip={{
        id: trip.id,
        vehicleName: trip.vehicle.name,
        vehicleRego: trip.vehicle.rego,
        startOdo: trip.startOdo,
        startedAt: trip.startedAt.toISOString(),
        purposeLabel: purposeLabelOf(trip),
      }}
    />
  );
}

import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Check, ChevronRight, TriangleAlert } from "lucide-react";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  detectExceptions,
  EXCEPTION_BLURBS,
  EXCEPTION_LABELS,
  type ExceptionKind,
} from "@/lib/van/exceptions";
import { tripInclude } from "@/lib/van/trips";
import { driverNameOf, orgLabelOf, purposeLabelOf } from "@/lib/van/queries";
import { formatDateTime, formatKm } from "@/lib/van/format";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/van/van-chrome";
import { cn } from "@/lib/utils";

/**
 * The exceptions view.
 *
 * Aggregating the paper book was painful, but the real damage was that nobody
 * could tell when it was wrong. Every entry here is recomputed from the trips
 * on each load and never stored, so fixing the underlying trip makes the entry
 * disappear on its own — this list cannot rot the way a table of resolved flags
 * would.
 */

const ORDER: ExceptionKind[] = [
  "odo-gap",
  "odo-overlap",
  "implausible-distance",
  "left-open",
  "closed-by-next-driver",
  "missing-photo",
];

export default async function VanExceptionsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [trips, vehicles] = await Promise.all([
    prisma.trip.findMany({
      include: tripInclude,
      orderBy: { startedAt: "desc" },
      // The chain rules need consecutive trips, so this is a window over the
      // recent record rather than a page of it.
      take: 1500,
    }),
    prisma.vehicle.findMany({ select: { id: true, name: true } }),
  ]);

  const exceptions = detectExceptions(trips, vehicles, new Date());
  const tripsById = new Map(trips.map((t) => [t.id, t]));
  const high = exceptions.filter((e) => e.severity === "high").length;

  const groups = ORDER.map((kind) => ({
    kind,
    items: exceptions.filter((e) => e.kind === kind),
  })).filter((group) => group.items.length > 0);

  return (
    <AdminPageWrapper
      title="Van exceptions"
      description="Worked out from the trips every time this page loads, never stored. Fix the underlying trip and the entry disappears on its own."
    >
      <PageContainer testid="van-exceptions-page">
        {exceptions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary dark:text-forest-200">
                <Check className="size-6" aria-hidden />
              </span>
              <p className="text-lg font-semibold">Everything reconciles</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Every odometer reading lines up with the one before it, every
                trip has photos, and nothing has been left open.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="danger" dot>
                {high} need attention
              </StatusPill>
              <StatusPill tone="neutral">
                {exceptions.length - high} worth a look
              </StatusPill>
            </div>

            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.kind} data-testid={`van-exception-group-${group.kind}`}>
                  <div className="flex items-baseline gap-2.5">
                    <h2 className="text-[15px] font-semibold">
                      {EXCEPTION_LABELS[group.kind]}
                    </h2>
                    <span className="text-[13px] tabular-nums text-muted-foreground">
                      {group.items.length}
                    </span>
                  </div>
                  <p className="mt-0.5 max-w-2xl text-[13px] leading-snug text-muted-foreground">
                    {EXCEPTION_BLURBS[group.kind]}
                  </p>

                  <ul className="mt-2.5 space-y-2">
                    {group.items.map((item) => {
                      const trip = tripsById.get(item.tripId);
                      const related = item.relatedTripId
                        ? tripsById.get(item.relatedTripId)
                        : null;
                      return (
                        <li key={item.id}>
                          <Card>
                            <CardContent className="flex flex-wrap items-start gap-3 p-4">
                              <span
                                className={cn(
                                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
                                  item.severity === "high"
                                    ? "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300"
                                    : "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"
                                )}
                              >
                                <TriangleAlert className="size-4" aria-hidden />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[15px] font-semibold leading-snug">
                                  {item.title}
                                </p>
                                <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
                                  {item.detail}
                                </p>
                                {trip && (
                                  <p className="mt-2 text-[13px] text-muted-foreground">
                                    {formatDateTime(trip.startedAt)} ·{" "}
                                    {driverNameOf(trip)} · {orgLabelOf(trip)} ·{" "}
                                    {purposeLabelOf(trip)}
                                    {trip.distanceKm !== null &&
                                      ` · ${formatKm(trip.distanceKm)}`}
                                  </p>
                                )}
                                {related && (
                                  <p className="mt-1 text-[13px] text-muted-foreground/80">
                                    Previous trip:{" "}
                                    {formatDateTime(related.startedAt)} ·{" "}
                                    {driverNameOf(related)}
                                  </p>
                                )}
                              </div>
                              <Link
                                href={`/drive/trip/${item.tripId}`}
                                className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-primary/10 dark:text-forest-200"
                              >
                                Trip
                                <ChevronRight className="size-3.5" aria-hidden />
                              </Link>
                            </CardContent>
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </PageContainer>
    </AdminPageWrapper>
  );
}

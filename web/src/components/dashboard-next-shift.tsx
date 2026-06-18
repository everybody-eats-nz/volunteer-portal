import { prisma } from "@/lib/prisma";
import { formatDistanceToNow } from "date-fns";
import { formatInNZT } from "@/lib/timezone";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MotionContentCard } from "@/components/motion-content-card";
import { AvatarList } from "@/components/ui/avatar-list";
import { Clock, Calendar, MapPin, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { LOCATION_ADDRESSES, type Location } from "@/lib/locations";
import { generateCalendarUrls } from "@/lib/calendar-utils";

interface DashboardNextShiftProps {
  userId: string;
}

export async function DashboardNextShift({ userId }: DashboardNextShiftProps) {
  const now = new Date();

  // Get user's friend IDs
  const friendships = await prisma.friendship.findMany({
    where: {
      AND: [
        { OR: [{ userId: userId }, { friendId: userId }] },
        { status: "ACCEPTED" },
      ],
    },
    select: {
      userId: true,
      friendId: true,
    },
  });

  const userFriendIds = friendships.map((f) =>
    f.userId === userId ? f.friendId : f.userId
  );

  // Next upcoming shift (confirmed or pending)
  const nextShift = await prisma.signup.findFirst({
    where: {
      userId: userId,
      shift: { start: { gte: now } },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    include: {
      shift: {
        include: {
          shiftType: true,
        },
      },
    },
    orderBy: { shift: { start: "asc" } },
  });

  // Get friends on this shift (separate query for cleaner typing)
  let friendsOnShift: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profilePhotoUrl: string | null;
  }[] = [];

  if (nextShift && userFriendIds.length > 0) {
    const friendSignups = await prisma.signup.findMany({
      where: {
        shiftId: nextShift.shiftId,
        userId: { in: userFriendIds },
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
            profilePhotoUrl: true,
          },
        },
      },
    });
    friendsOnShift = friendSignups.map((s) => s.user);
  }

  return (
    <MotionContentCard
      className="grain relative h-fit flex-1 min-w-80 overflow-hidden rounded-3xl border-forest-500/10 dark:border-cream-50/10"
      delay={0.2}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest-500 to-forest-300 dark:from-forest-400 dark:to-forest-300" />
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
            <Clock className="h-5 w-5" />
          </span>
          <span className="display text-xl tracking-tight text-forest-700 dark:text-cream-50">
            Your Next Shift
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nextShift ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/shifts/${nextShift.shift.id}`}
                  className="block display text-lg tracking-tight text-forest-700 dark:text-cream-50 underline-offset-4 hover:underline"
                  data-testid="next-shift-details-link"
                >
                  {nextShift.shift.shiftType.name}
                </Link>
                {nextShift.shift.location && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `Everybody Eats ${LOCATION_ADDRESSES[nextShift.shift.location as Location] || nextShift.shift.location}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-forest-700/70 underline-offset-4 transition-colors hover:text-forest-500 hover:underline dark:text-cream-50/70 dark:hover:text-cream-50"
                    data-testid="shift-location-link"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-forest-500 dark:text-cream-50/70" />
                    {LOCATION_ADDRESSES[
                      nextShift.shift.location as Location
                    ]?.replace(", New Zealand", "") || nextShift.shift.location}
                  </a>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Badge
                  variant="secondary"
                  className="border border-forest-500/15 bg-forest-500/8 text-forest-700 dark:border-cream-50/15 dark:bg-cream-50/10 dark:text-cream-50/85"
                >
                  {formatDistanceToNow(nextShift.shift.start, {
                    addSuffix: true,
                  })}
                </Badge>
                {nextShift.status === "PENDING" && (
                  <Badge
                    variant="outline"
                    className="border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300"
                  >
                    Pending Approval
                  </Badge>
                )}
                {nextShift.status === "CONFIRMED" && (
                  <Badge>Confirmed</Badge>
                )}
              </div>
            </div>
            <div className="space-y-2 text-forest-700/85 dark:text-cream-50/80">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-forest-500 dark:text-cream-50/60" />
                {formatInNZT(nextShift.shift.start, "EEEE, MMMM do")}
              </div>
              <div className="flex items-center gap-2 text-sm tabular-nums">
                <Clock className="h-4 w-4 text-forest-500 dark:text-cream-50/60" />
                {formatInNZT(nextShift.shift.start, "h:mm a")} -{" "}
                {formatInNZT(nextShift.shift.end, "h:mm a")}
              </div>
            </div>

            {nextShift.shift.notes && (
              <div className="rounded-xl border border-forest-500/8 bg-forest-500/5 p-3 dark:border-cream-50/8 dark:bg-cream-50/5">
                <p className="text-sm text-forest-700/75 dark:text-cream-50/70">
                  {nextShift.shift.notes}
                </p>
              </div>
            )}

            {/* Friends joining */}
            {friendsOnShift.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-medium text-forest-700 dark:text-cream-50">
                  Friends Joining
                </div>
                <AvatarList users={friendsOnShift} size="md" maxDisplay={6} />
              </div>
            )}

            {/* Add to Calendar */}
            <div className="border-t border-forest-500/10 pt-3 dark:border-cream-50/10">
              <div className="mb-2 text-sm font-medium text-forest-700/70 dark:text-cream-50/65">
                Add to Calendar
              </div>
              <div className="flex gap-2 flex-wrap">
                {(() => {
                  const urls = generateCalendarUrls(nextShift.shift);
                  return (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        asChild
                      >
                        <a
                          href={urls.google}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                          Google
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        asChild
                      >
                        <a
                          href={urls.outlook}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                          Outlook
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        asChild
                      >
                        <a
                          href={urls.ics}
                          download={`shift-${nextShift.shift.id}.ics`}
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                          .ics
                        </a>
                      </Button>
                    </>
                  );
                })()}
              </div>
            </div>

            <Button asChild size="sm" className="w-full">
              <Link href="/shifts/mine">View All My Shifts</Link>
            </Button>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="relative mx-auto mb-4 w-fit">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
                <Calendar className="h-8 w-8" />
              </span>
            </div>
            <h3 className="display text-lg tracking-tight text-forest-700 dark:text-cream-50">
              No upcoming shifts
            </h3>
            <p className="mx-auto mb-4 mt-2 max-w-xs text-sm text-forest-700/70 dark:text-cream-50/65">
              Browse available shifts and sign up for your next volunteer
              opportunity.
            </p>
            <Button asChild size="sm">
              <Link href="/shifts">Browse Shifts</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </MotionContentCard>
  );
}

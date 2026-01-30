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
    <MotionContentCard className="h-fit flex-1 min-w-80" delay={0.2}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary dark:text-emerald-400" />
          Your Next Shift
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nextShift ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <Link
                  href={`/shifts/${nextShift.shift.id}`}
                  className="block font-semibold text-lg hover:text-primary transition-colors"
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
                    className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
                    data-testid="shift-location-link"
                  >
                    <MapPin className="w-4 h-4" />
                    {LOCATION_ADDRESSES[
                      nextShift.shift.location as Location
                    ]?.replace(", New Zealand", "") || nextShift.shift.location}
                  </a>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant="secondary">
                  {formatDistanceToNow(nextShift.shift.start, {
                    addSuffix: true,
                  })}
                </Badge>
                {nextShift.status === "PENDING" && (
                  <Badge
                    variant="outline"
                    className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/50"
                  >
                    Pending Approval
                  </Badge>
                )}
                {nextShift.status === "CONFIRMED" && (
                  <Badge>Confirmed</Badge>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground dark:text-gray-400" />
                {formatInNZT(nextShift.shift.start, "EEEE, MMMM do")}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground dark:text-gray-400" />
                {formatInNZT(nextShift.shift.start, "h:mm a")} -{" "}
                {formatInNZT(nextShift.shift.end, "h:mm a")}
              </div>
            </div>

            {nextShift.shift.notes && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {nextShift.shift.notes}
                </p>
              </div>
            )}

            {/* Friends joining */}
            {friendsOnShift.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Friends Joining</div>
                <AvatarList users={friendsOnShift} size="md" maxDisplay={6} />
              </div>
            )}

            {/* Add to Calendar */}
            <div className="pt-2 border-t">
              <div className="text-sm font-medium text-muted-foreground mb-2">
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
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted dark:bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground dark:text-gray-500" />
            </div>
            <h3 className="font-semibold mb-2">No upcoming shifts</h3>
            <p className="text-muted-foreground text-sm mb-4">
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

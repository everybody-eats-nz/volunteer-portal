import { prisma } from "@/lib/prisma";
import { ShiftsCalendar } from "@/components/shifts-calendar";
import { buildShiftEventSchema } from "@/lib/seo";

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
  friendSignups?: FriendSignup[];
}

interface ShiftsCalendarSectionProps {
  filterLocations: string[];
  selectedLocation?: string;
  currentUserId?: string;
}

/**
 * Heavy data layer for the calendar view — fetches upcoming shifts (and, for
 * signed-in users, friends' signups filtered by privacy) and renders the
 * calendar plus Event JSON-LD. Rendered inside a <Suspense> boundary so the
 * page shell (header + back button) streams immediately while this resolves,
 * showing <ShiftsCalendarSkeleton> in the meantime.
 */
export async function ShiftsCalendarSection({
  filterLocations,
  selectedLocation,
  currentUserId,
}: ShiftsCalendarSectionProps) {
  // Single server-side timestamp, reused for the shift query and seeded into
  // the calendar so SSR and client hydration agree on "now" (see ShiftsCalendar).
  const now = new Date();

  // Friend IDs (only needed to filter friends' signups for signed-in users)
  let userFriendIds: string[] = [];
  if (currentUserId) {
    userFriendIds = await prisma.friendship
      .findMany({
        where: {
          AND: [
            { OR: [{ userId: currentUserId }, { friendId: currentUserId }] },
            { status: "ACCEPTED" },
          ],
        },
        select: { userId: true, friendId: true },
      })
      .then((friendships) =>
        friendships.map((friendship) =>
          friendship.userId === currentUserId
            ? friendship.friendId
            : friendship.userId
        )
      );
  }

  // Fetch shifts for calendar view - simplified data structure
  const shifts = await prisma.shift.findMany({
    where: {
      start: { gte: now },
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
          placeholders: true,
        },
      },
    },
  });

  // Fetch all signups and filter by privacy settings
  let friendSignupsMap: Record<string, FriendSignup[]> = {};
  if (currentUserId) {
    const allSignups = await prisma.signup.findMany({
      where: {
        shiftId: { in: shifts.map((s) => s.id) },
        status: { in: ["CONFIRMED", "PENDING", "REGULAR_PENDING"] },
        // Exclude the current user from the list
        userId: { not: currentUserId },
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
    confirmedCount: shift._count.signups + shift._count.placeholders, // Includes CONFIRMED, PENDING, REGULAR_PENDING + unregistered volunteers
    pendingCount: 0, // For calendar view, we simplify by putting all counts in confirmedCount
    shiftType: {
      name: shift.shiftType.name,
      description: shift.shiftType.description,
    },
    friendSignups: friendSignupsMap[shift.id] || [],
  }));

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
      <ShiftsCalendar
        shifts={shiftSummaries}
        selectedLocation={selectedLocation}
        serverNow={now.getTime()}
      />
    </>
  );
}

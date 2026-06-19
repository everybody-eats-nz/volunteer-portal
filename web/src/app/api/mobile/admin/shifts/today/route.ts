import { NextResponse } from "next/server";
import { startOfDay, endOfDay } from "date-fns";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { formatInNZT, parseISOInNZT, toUTC } from "@/lib/timezone";

/**
 * GET /api/mobile/admin/shifts/today?date=YYYY-MM-DD&location=
 *
 * Service-day overview for admins on the floor: every shift on the given day
 * (default: today in NZT), each with confirmed/capacity/pending counts and the
 * roster of signed-up volunteers. Read-only — actions live on the approvals
 * endpoint.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const dateParam =
    url.searchParams.get("date") ?? formatInNZT(new Date(), "yyyy-MM-dd");
  const location = url.searchParams.get("location") ?? undefined;

  const nzDate = parseISOInNZT(dateParam);
  const startUTC = toUTC(startOfDay(nzDate));
  const endUTC = toUTC(endOfDay(nzDate));

  const shifts = await prisma.shift.findMany({
    where: {
      start: { gte: startUTC, lte: endUTC },
      ...(location ? { location } : {}),
    },
    orderBy: [{ start: "asc" }],
    select: {
      id: true,
      start: true,
      end: true,
      location: true,
      capacity: true,
      shiftType: { select: { name: true } },
      signups: {
        where: {
          status: {
            in: ["CONFIRMED", "PENDING", "WAITLISTED", "REGULAR_PENDING"],
          },
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              profilePhotoUrl: true,
            },
          },
        },
      },
    },
  });

  const items = shifts.map((shift) => {
    const signups = shift.signups.map((s) => ({
      id: s.id,
      status: s.status,
      volunteer: {
        id: s.user.id,
        name:
          [s.user.firstName, s.user.lastName].filter(Boolean).join(" ") ||
          s.user.name ||
          "Volunteer",
        profilePhotoUrl: s.user.profilePhotoUrl,
      },
    }));

    const confirmedCount = signups.filter((s) => s.status === "CONFIRMED").length;
    const pendingCount = signups.filter(
      (s) => s.status === "PENDING" || s.status === "REGULAR_PENDING"
    ).length;
    const waitlistedCount = signups.filter(
      (s) => s.status === "WAITLISTED"
    ).length;

    return {
      id: shift.id,
      start: shift.start,
      end: shift.end,
      location: shift.location,
      capacity: shift.capacity,
      shiftTypeName: shift.shiftType.name,
      confirmedCount,
      pendingCount,
      waitlistedCount,
      // Negative when understaffed — the screen flags these.
      fillGap: shift.capacity - confirmedCount,
      signups,
    };
  });

  return NextResponse.json({
    date: dateParam,
    shifts: items,
  });
}

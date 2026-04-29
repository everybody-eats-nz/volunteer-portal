import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/announcements/shifts
 *
 * Lists upcoming shifts (today + next 60 days by default) so admins can pick
 * which shifts to target an announcement at. Returns the same statuses-of-
 * interest signup count that the admin shifts page surfaces.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(request.url);
  const location = url.searchParams.get("location");
  const days = Math.min(
    Math.max(parseInt(url.searchParams.get("days") ?? "60", 10) || 60, 1),
    180
  );

  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const shifts = await prisma.shift.findMany({
    where: {
      start: { gte: now, lte: horizon },
      ...(location ? { location } : {}),
    },
    select: {
      id: true,
      start: true,
      end: true,
      location: true,
      shiftType: { select: { name: true } },
      _count: {
        select: {
          signups: {
            where: {
              status: {
                in: [
                  "CONFIRMED",
                  "PENDING",
                  "WAITLISTED",
                  "REGULAR_PENDING",
                  "NO_SHOW",
                ],
              },
            },
          },
        },
      },
    },
    orderBy: { start: "asc" },
    take: 500,
  });

  return NextResponse.json({
    shifts: shifts.map((s) => ({
      id: s.id,
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      location: s.location,
      shiftTypeName: s.shiftType.name,
      signupCount: s._count.signups,
    })),
  });
}

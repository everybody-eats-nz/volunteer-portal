import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/client";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/mobile/admin/signups/pending
 *
 * Pending signups (PENDING / REGULAR_PENDING) for upcoming shifts, so admins
 * can clear the approval queue on the go. Optional ?location= filter.
 *
 * Ordered by shift date, soonest first, so the most urgent decisions sit at
 * the top. Signups for the same shift stay together, oldest request first.
 * Sorting here (not in the app) also means `limit` keeps the soonest shifts
 * rather than the oldest requests, and store builds pick it up without a
 * release.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const location = url.searchParams.get("location") ?? undefined;
  // A negative `take` makes Prisma read from the end of the list (the
  // furthest-out shifts), and NaN throws, so fall back to the default for
  // anything that isn't a positive whole number.
  const requested = Math.trunc(Number(url.searchParams.get("limit") ?? 50));
  const limit = requested >= 1 ? Math.min(requested, 100) : 50;

  const where: Prisma.SignupWhereInput = {
    status: { in: ["PENDING", "REGULAR_PENDING"] },
    shift: {
      start: { gte: new Date() },
      ...(location ? { location } : {}),
    },
  };

  const signups = await prisma.signup.findMany({
    where,
    // `id` last makes the order total, so signups created in the same
    // instant (bulk regular inserts) never swap between requests.
    orderBy: [
      { shift: { start: "asc" } },
      { shiftId: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      status: true,
      createdAt: true,
      waitlistIfFull: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          profilePhotoUrl: true,
          volunteerGrade: true,
        },
      },
      shift: {
        select: {
          id: true,
          start: true,
          end: true,
          location: true,
          capacity: true,
          shiftType: { select: { name: true } },
          _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
        },
      },
    },
  });

  const items = signups.map((s) => ({
    id: s.id,
    status: s.status,
    createdAt: s.createdAt,
    waitlistIfFull: s.waitlistIfFull,
    volunteer: {
      id: s.user.id,
      name:
        [s.user.firstName, s.user.lastName].filter(Boolean).join(" ") ||
        s.user.name ||
        s.user.email,
      email: s.user.email,
      profilePhotoUrl: s.user.profilePhotoUrl,
      volunteerGrade: s.user.volunteerGrade,
    },
    shift: {
      id: s.shift.id,
      start: s.shift.start,
      end: s.shift.end,
      location: s.shift.location,
      capacity: s.shift.capacity,
      confirmedCount: s.shift._count.signups,
      shiftTypeName: s.shift.shiftType.name,
    },
  }));

  return NextResponse.json({ signups: items });
}

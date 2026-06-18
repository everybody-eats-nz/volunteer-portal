import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/client";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/mobile/admin/signups/pending
 *
 * Pending signups (PENDING / REGULAR_PENDING) for upcoming shifts, oldest
 * request first, so admins can clear the approval queue on the go. Optional
 * ?location= filter.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const location = url.searchParams.get("location") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const where: Prisma.SignupWhereInput = {
    status: { in: ["PENDING", "REGULAR_PENDING"] },
    shift: {
      start: { gte: new Date() },
      ...(location ? { location } : {}),
    },
  };

  const signups = await prisma.signup.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      status: true,
      createdAt: true,
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

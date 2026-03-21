import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/shifts
 *
 * Returns shifts categorized for the authenticated user:
 * - myShifts: upcoming shifts the user is signed up for (CONFIRMED, PENDING, WAITLISTED, REGULAR_PENDING)
 * - available: upcoming shifts with open spots the user is NOT signed up for
 * - past: past shifts the user attended (CONFIRMED)
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { userId } = auth;

  // Active signup statuses (not canceled/no-show/etc)
  const activeStatuses = ["CONFIRMED", "PENDING", "WAITLISTED", "REGULAR_PENDING"] as const;

  // Fetch upcoming shifts the user is signed up for
  const mySignups = await prisma.signup.findMany({
    where: {
      userId,
      status: { in: [...activeStatuses] },
      shift: { start: { gte: now } },
    },
    include: {
      shift: {
        include: {
          shiftType: true,
          signups: { where: { status: "CONFIRMED" } },
        },
      },
    },
    orderBy: { shift: { start: "asc" } },
  });

  // Fetch available upcoming shifts (that the user is NOT signed up for)
  const userSignedUpShiftIds = mySignups.map((s) => s.shift.id);

  const availableShifts = await prisma.shift.findMany({
    where: {
      start: { gte: now },
      id: { notIn: userSignedUpShiftIds.length > 0 ? userSignedUpShiftIds : undefined },
    },
    include: {
      shiftType: true,
      signups: { where: { status: "CONFIRMED" } },
    },
    orderBy: { start: "asc" },
  });

  // Fetch past shifts the user attended
  const pastSignups = await prisma.signup.findMany({
    where: {
      userId,
      status: { in: ["CONFIRMED"] },
      shift: { end: { lt: now } },
    },
    include: {
      shift: {
        include: {
          shiftType: true,
          signups: { where: { status: "CONFIRMED" } },
        },
      },
    },
    orderBy: { shift: { start: "desc" } },
    take: 20,
  });

  // Transform to the mobile app's Shift shape
  const toMobileShift = (
    shift: {
      id: string;
      start: Date;
      end: Date;
      location: string | null;
      capacity: number;
      notes: string | null;
      shiftType: { id: string; name: string; description: string | null };
      signups: { id: string }[];
    },
    status?: string | null
  ) => ({
    id: shift.id,
    shiftType: {
      id: shift.shiftType.id,
      name: shift.shiftType.name,
      description: shift.shiftType.description ?? "",
    },
    start: shift.start.toISOString(),
    end: shift.end.toISOString(),
    location: shift.location ?? "TBC",
    capacity: shift.capacity,
    signedUp: shift.signups.length,
    status: status ?? null,
    notes: shift.notes,
  });

  return NextResponse.json({
    myShifts: mySignups.map((signup) =>
      toMobileShift(signup.shift, signup.status)
    ),
    available: availableShifts
      .filter((s) => s.signups.length < s.capacity)
      .map((s) => toMobileShift(s)),
    past: pastSignups.map((signup) =>
      toMobileShift(signup.shift, signup.status)
    ),
  });
}

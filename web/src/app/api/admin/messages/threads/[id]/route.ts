import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@/generated/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { listMessages } from "@/lib/services/messaging";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const thread = await prisma.messageThread.findUnique({
    where: { id },
    include: {
      volunteer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          phone: true,
          profilePhotoUrl: true,
          defaultLocation: true,
          volunteerGrade: true,
          createdAt: true,
        },
      },
    },
  });
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const messages = await listMessages({
    threadId: id,
    before: before ? new Date(before) : undefined,
    limit,
  });

  // Volunteer-context sidebar: count + soonest upcoming shift.
  const now = new Date();
  const upcomingWhere = {
    userId: thread.volunteerId,
    status: { in: ["CONFIRMED", "PENDING", "WAITLISTED"] },
    shift: { start: { gte: now } },
  } satisfies Prisma.SignupWhereInput;

  const [upcomingShiftCount, nextSignup] = await Promise.all([
    prisma.signup.count({ where: upcomingWhere }),
    prisma.signup.findFirst({
      where: upcomingWhere,
      orderBy: { shift: { start: "asc" } },
      select: {
        id: true,
        status: true,
        shift: {
          select: {
            id: true,
            start: true,
            end: true,
            location: true,
            notes: true,
            capacity: true,
            shiftType: { select: { name: true } },
            _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
          },
        },
      },
    }),
  ]);

  const nextShift = nextSignup
    ? {
        signupId: nextSignup.id,
        signupStatus: nextSignup.status,
        id: nextSignup.shift.id,
        start: nextSignup.shift.start,
        end: nextSignup.shift.end,
        location: nextSignup.shift.location,
        notes: nextSignup.shift.notes,
        capacity: nextSignup.shift.capacity,
        confirmedCount: nextSignup.shift._count.signups,
        shiftTypeName: nextSignup.shift.shiftType.name,
      }
    : null;

  return NextResponse.json({ thread, messages, upcomingShiftCount, nextShift });
}

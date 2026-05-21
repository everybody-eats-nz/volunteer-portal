import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@/generated/client";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { listMessages } from "@/lib/services/messaging";
import {
  getShiftEffectiveCount,
  shiftCapacityCountSelect,
} from "@/lib/placeholder-utils";

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
          // Powers the "no mobile app" inbox hint. Stamped on every mobile
          // auth event (login + cold-start /me), so null means the volunteer
          // has never opened the app while signed in.
          lastMobileLoginAt: true,
        },
      },
    },
  });
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Flatten the timestamp into a friendlier boolean for the client.
  const { lastMobileLoginAt, ...volunteerRest } = thread.volunteer;
  const threadForClient = {
    ...thread,
    volunteer: {
      ...volunteerRest,
      hasMobileApp: lastMobileLoginAt !== null,
    },
  };

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
            _count: shiftCapacityCountSelect(["CONFIRMED"]),
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
        confirmedCount: getShiftEffectiveCount(nextSignup.shift),
        shiftTypeName: nextSignup.shift.shiftType.name,
      }
    : null;

  return NextResponse.json({
    thread: threadForClient,
    messages,
    upcomingShiftCount,
    nextShift,
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

// POST /api/admin/volunteer-movement - Move a volunteer from one shift to another
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    
    const schema = z.object({
      signupId: z.string().cuid(),
      targetShiftId: z.string().cuid(),
      movementNotes: z.string().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { signupId, targetShiftId, movementNotes } = parsed.data;

    // Verify the signup exists
    const signup = await prisma.signup.findUnique({
      where: { id: signupId },
      include: {
        shift: {
          include: { shiftType: true },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!signup) {
      return NextResponse.json(
        { error: "Signup not found" },
        { status: 404 }
      );
    }

    // Verify target shift exists and has capacity
    const targetShift = await prisma.shift.findUnique({
      where: { id: targetShiftId },
      include: {
        shiftType: true,
        signups: {
          where: {
            status: "CONFIRMED",
          },
        },
      },
    });

    if (!targetShift) {
      return NextResponse.json(
        { error: "Target shift not found" },
        { status: 404 }
      );
    }

    // Check if target shift has capacity
    if (targetShift.signups.length >= targetShift.capacity) {
      return NextResponse.json(
        { error: "Target shift is at full capacity" },
        { status: 400 }
      );
    }

    // Check if volunteer already has a signup for this shift
    const existingSignup = await prisma.signup.findUnique({
      where: {
        userId_shiftId: {
          userId: signup.userId,
          shiftId: targetShiftId,
        },
      },
    });

    if (existingSignup) {
      return NextResponse.json(
        { error: "Volunteer is already signed up for this shift" },
        { status: 400 }
      );
    }

    // Check if this would create a double booking on the same day (in NZ timezone)
    // Get the calendar date of the target shift in NZ timezone
    const targetShiftNZDate = new Intl.DateTimeFormat("en-NZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Pacific/Auckland",
    }).format(targetShift.start);

    // Get all confirmed signups for this user (excluding the current signup being moved)
    const otherConfirmedSignups = await prisma.signup.findMany({
      where: {
        userId: signup.userId,
        status: "CONFIRMED",
        id: { not: signupId }, // Exclude the current signup we're moving
      },
      include: {
        shift: {
          include: {
            shiftType: true,
          },
        },
      },
    });

    // Check if any of them are on the same NZ calendar day
    const existingDailySignup = otherConfirmedSignups.find((otherSignup) => {
      const otherSignupNZDate = new Intl.DateTimeFormat("en-NZ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Pacific/Auckland",
      }).format(otherSignup.shift.start);
      return otherSignupNZDate === targetShiftNZDate;
    });
    
    if (existingDailySignup) {
      return NextResponse.json(
        { 
          error: `Volunteer already has a confirmed shift on this day: ${existingDailySignup.shift.shiftType.name}. A volunteer can only have one shift per day.`
        },
        { status: 400 }
      );
    }

    // Use transaction to handle the movement
    const result = await prisma.$transaction(async (tx) => {
      const originalShiftId = signup.shiftId;
      
      // Update the signup to point to the new shift
      const updatedSignup = await tx.signup.update({
        where: { id: signupId },
        data: {
          shiftId: targetShiftId,
          status: "CONFIRMED", // Confirm the movement
        },
        include: {
          shift: {
            include: { shiftType: true },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Create notification for the volunteer about their movement
      const notificationTitle = "You've been moved to a different shift";
      const notificationMessage = `You've been moved from ${signup.shift.shiftType.name} to ${targetShift.shiftType.name} on ${targetShift.start.toLocaleDateString('en-NZ')} at ${targetShift.location}`;

      await tx.notification.create({
        data: {
          userId: signup.userId,
          type: "SHIFT_CONFIRMED",
          title: notificationTitle,
          message: notificationMessage,
          actionUrl: "/shifts/mine",
          relatedId: targetShiftId,
          isRead: false,
        },
      });

      return updatedSignup;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error moving volunteer:", error);
    return NextResponse.json(
      { error: "Failed to move volunteer" },
      { status: 500 }
    );
  }
}
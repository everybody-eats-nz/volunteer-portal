import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { moveVolunteerSchema } from "@/lib/validation-schemas";
import { getEmailService } from "@/lib/email-service";
import { formatInNZT } from "@/lib/timezone";
import { isFirstConfirmedShift } from "@/lib/shift-helpers";

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

    const parsed = moveVolunteerSchema.safeParse(body);
    if (!parsed.success) {
      // Surface the failing field. A bare "Invalid input" told an admin
      // nothing about what to do next, and nothing about what to report.
      console.error("Invalid volunteer movement request:", parsed.error.issues);
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid input",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { signupId, targetShiftId } = parsed.data;

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

    // Verify target shift exists. Capacity is deliberately not enforced here -
    // admins can move a volunteer into a full shift and take it over capacity,
    // the same way they can confirm a waitlisted volunteer beyond capacity.
    const targetShift = await prisma.shift.findUnique({
      where: { id: targetShiftId },
      include: {
        shiftType: true,
      },
    });

    if (!targetShift) {
      return NextResponse.json(
        { error: "Target shift not found" },
        { status: 404 }
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

    // The move always lands the volunteer on CONFIRMED. Anyone who wasn't
    // already confirmed - pending, or sitting on a waitlist - is finding out
    // they have a spot for the first time, so they get the confirmation email.
    const wasWaitlisted = signup.status === "WAITLISTED";
    const wasUnconfirmed =
      wasWaitlisted ||
      signup.status === "PENDING" ||
      signup.status === "REGULAR_PENDING";

    // Use transaction to handle the movement
    const result = await prisma.$transaction(async (tx) => {
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

      // Create notification for the volunteer about their movement. Coming off
      // a waitlist is good news rather than a reshuffle, so it gets its own
      // wording - "moved" would bury the part they care about.
      const notificationTitle = wasWaitlisted
        ? "You're off the waitlist and confirmed"
        : "You've been moved to a different shift";
      const notificationMessage = wasWaitlisted
        ? `You've been taken off the waitlist for ${signup.shift.shiftType.name} and confirmed for ${targetShift.shiftType.name} on ${targetShift.start.toLocaleDateString('en-NZ')} at ${targetShift.location}`
        : `You've been moved from ${signup.shift.shiftType.name} to ${targetShift.shiftType.name} on ${targetShift.start.toLocaleDateString('en-NZ')} at ${targetShift.location}`;

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

    // Newly confirmed volunteers get the standard shift confirmation email
    if (wasUnconfirmed && result.user.email) {
      try {
        // Check if this is the volunteer's first confirmed shift
        const isFirstShift = await isFirstConfirmedShift(
          result.user.id,
          targetShiftId
        );

        const volunteerName = `${result.user.firstName} ${result.user.lastName}`;
        const shiftDate = formatInNZT(targetShift.start, "EEEE, MMMM d, yyyy");
        const shiftTime = `${formatInNZT(targetShift.start, "h:mm a")} - ${formatInNZT(targetShift.end, "h:mm a")}`;

        const emailService = getEmailService();
        await emailService.sendShiftConfirmationNotification({
          to: result.user.email,
          volunteerName,
          shiftName: targetShift.shiftType.name,
          shiftDate,
          shiftTime,
          location: targetShift.location || "TBD",
          shiftId: targetShiftId,
          shiftStart: targetShift.start,
          shiftEnd: targetShift.end,
          isFirstShift: isFirstShift,
        });
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error moving volunteer:", error);
    return NextResponse.json(
      { error: "Failed to move volunteer" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createShiftConfirmedNotification } from "@/lib/notifications";
import { getEmailService } from "@/lib/email-service";
import { formatInNZT } from "@/lib/timezone";
import { LOCATION_ADDRESSES } from "@/lib/locations";
import { isFirstConfirmedShift } from "@/lib/shift-helpers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: shiftId } = await params;

  try {
    const body = await req.json();
    const { volunteerId, status = "CONFIRMED", note } = body;

    if (!volunteerId) {
      return NextResponse.json(
        { error: "Volunteer ID is required" },
        { status: 400 }
      );
    }

    // Validate status
    if (status !== "CONFIRMED" && status !== "WAITLISTED") {
      return NextResponse.json(
        { error: "Status must be CONFIRMED or WAITLISTED" },
        { status: 400 }
      );
    }

    // Find the shift
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        shiftType: true,
        signups: {
          where: {
            status: "CONFIRMED",
          },
        },
      },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Find the volunteer
    const volunteer = await prisma.user.findUnique({
      where: { id: volunteerId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
      },
    });

    if (!volunteer) {
      return NextResponse.json(
        { error: "Volunteer not found" },
        { status: 404 }
      );
    }

    // Check if volunteer already has a signup for this shift
    const existingSignup = await prisma.signup.findUnique({
      where: {
        userId_shiftId: {
          userId: volunteer.id,
          shiftId: shift.id,
        },
      },
    });

    if (existingSignup) {
      // If the existing signup was canceled, delete it and allow re-assignment
      if (existingSignup.status === "CANCELED") {
        await prisma.signup.delete({
          where: { id: existingSignup.id },
        });
      } else {
        return NextResponse.json(
          {
            error: `Volunteer is already ${existingSignup.status.toLowerCase()} for this shift`,
          },
          { status: 400 }
        );
      }
    }

    // Check capacity (warn if over capacity for CONFIRMED assignments)
    const confirmedCount = shift.signups.length;
    const isOverCapacity = confirmedCount >= shift.capacity;

    // Check if volunteer already has a confirmed signup for the same day (in NZ timezone)
    const shiftNZDate = new Intl.DateTimeFormat("en-NZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Pacific/Auckland",
    }).format(shift.start);

    const confirmedSignups = await prisma.signup.findMany({
      where: {
        userId: volunteer.id,
        status: "CONFIRMED",
      },
      include: {
        shift: {
          include: {
            shiftType: true,
          },
        },
      },
    });

    const existingDailySignup = confirmedSignups.find((signup) => {
      const signupNZDate = new Intl.DateTimeFormat("en-NZ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Pacific/Auckland",
      }).format(signup.shift.start);
      return signupNZDate === shiftNZDate;
    });

    if (existingDailySignup && status === "CONFIRMED") {
      const existingShiftTime = new Intl.DateTimeFormat("en-NZ", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Pacific/Auckland",
      }).format(existingDailySignup.shift.start);

      const location = existingDailySignup.shift.location;

      return NextResponse.json(
        {
          error: `This volunteer already has a confirmed shift on this day: ${existingDailySignup.shift.shiftType.name} at ${location}, ${existingShiftTime}. Volunteers can only be assigned to one shift per day.`,
        },
        { status: 400 }
      );
    }

    // Create the signup (admin assignment bypasses auto-approval rules)
    const signup = await prisma.signup.create({
      data: {
        userId: volunteer.id,
        shiftId: shift.id,
        status: status,
        note: note || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
          },
        },
        shift: {
          include: {
            shiftType: true,
          },
        },
      },
    });

    // Send confirmation email if status is CONFIRMED (fire-and-forget with timeout)
    if (status === "CONFIRMED") {
      // Check if this is the volunteer's first confirmed shift
      const isFirstShift = await isFirstConfirmedShift(volunteer.id, shift.id);

      const emailService = getEmailService();
      const shiftDate = formatInNZT(shift.start, "EEEE, MMMM d, yyyy");
      const shiftTime = `${formatInNZT(shift.start, "h:mm a")} - ${formatInNZT(
        shift.end,
        "h:mm a"
      )}`;
      const fullAddress = shift.location
        ? LOCATION_ADDRESSES[shift.location as keyof typeof LOCATION_ADDRESSES] ||
          shift.location
        : "TBD";

      Promise.race([
        emailService.sendShiftConfirmationNotification({
          to: volunteer.email!,
          volunteerName:
            volunteer.name ||
            `${volunteer.firstName || ""} ${volunteer.lastName || ""}`.trim(),
          shiftName: shift.shiftType.name,
          shiftDate: shiftDate,
          shiftTime: shiftTime,
          location: fullAddress,
          shiftId: shift.id,
          shiftStart: shift.start,
          shiftEnd: shift.end,
          isFirstShift: isFirstShift,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Email send timeout")), 10000)
        ),
      ]).catch((emailError) => {
        console.error("Error sending confirmation email:", emailError);
      });

      // Create in-app notification
      try {
        const shiftDate = new Intl.DateTimeFormat("en-NZ", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Pacific/Auckland",
        }).format(shift.start);

        await createShiftConfirmedNotification(
          volunteer.id,
          shift.shiftType.name,
          shiftDate,
          shift.id
        );
      } catch (notificationError) {
        console.error(
          "Error creating confirmation notification:",
          notificationError
        );
      }
    }

    return NextResponse.json({
      ...signup,
      message: `Volunteer successfully assigned to shift${isOverCapacity && status === "CONFIRMED" ? " (shift is now over capacity)" : ""}`,
      isOverCapacity: isOverCapacity && status === "CONFIRMED",
    });
  } catch (error) {
    console.error("Admin assign volunteer error:", error);
    return NextResponse.json(
      { error: "Failed to assign volunteer to shift" },
      { status: 500 }
    );
  }
}

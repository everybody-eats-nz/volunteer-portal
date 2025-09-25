import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getEmailService } from "@/lib/email-service";
import { format } from "date-fns";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { shiftId, volunteerIds } = body;

    // Fetch shift details
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        shiftType: true,
        _count: {
          select: {
            signups: {
              where: {
                status: {
                  in: ["CONFIRMED", "REGULAR_PENDING"],
                },
              },
            },
          },
        },
      },
    });

    if (!shift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Fetch volunteer details
    const volunteers = await prisma.user.findMany({
      where: {
        id: {
          in: volunteerIds,
        },
        receiveShortageNotifications: true, // Only send to those who opted in
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
      },
    });

    if (volunteers.length === 0) {
      return NextResponse.json(
        { error: "No eligible volunteers found" },
        { status: 400 }
      );
    }

    // Calculate shortage info
    const currentVolunteers = shift._count.signups;
    const neededVolunteers = shift.capacity - currentVolunteers;
    const shiftDate = format(new Date(shift.start), "EEEE, MMMM d, yyyy");
    const shiftTime = `${format(new Date(shift.start), "h:mm a")} - ${format(new Date(shift.end), "h:mm a")}`;

    // Send emails via Campaign Monitor
    const emailService = getEmailService();
    const emailPromises = volunteers.map(async (volunteer) => {
      // Build volunteer name for email - this will be used to extract firstName in the email service
      const volunteerName = volunteer.firstName && volunteer.lastName
        ? `${volunteer.firstName} ${volunteer.lastName}`
        : volunteer.name || volunteer.email;

      try {
        await emailService.sendShiftShortageNotification({
          to: volunteer.email,
          volunteerName,
          shiftName: shift.shiftType.name,
          shiftDate,
          shiftTime,
          location: shift.location || "TBD",
          currentVolunteers,
          neededVolunteers,
          shiftId: shift.id,
        });

        return { success: true, email: volunteer.email };
      } catch (error) {
        console.error(`Failed to send email to ${volunteer.email}:`, error);
        return { success: false, email: volunteer.email, error: (error as Error).message };
      }
    });

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(
      r => r.status === "fulfilled" && r.value.success
    ).length;

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      totalCount: volunteers.length,
      results: results.map(r => r.status === "fulfilled" ? r.value : { success: false }),
    });
  } catch (error) {
    console.error("Error sending shortage notifications:", error);
    return NextResponse.json(
      { error: "Failed to send notifications" },
      { status: 500 }
    );
  }
}
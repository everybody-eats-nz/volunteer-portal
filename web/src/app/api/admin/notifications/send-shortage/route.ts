import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getEmailService } from "@/lib/email-service";
import { formatInNZT } from "@/lib/timezone";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { shiftIds, volunteerIds } = body;

    // Validate that shiftIds is an array
    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return NextResponse.json(
        { error: "At least one shift must be selected" },
        { status: 400 }
      );
    }

    // Fetch all selected shifts
    const shifts = await prisma.shift.findMany({
      where: { id: { in: shiftIds } },
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
      orderBy: { start: "asc" },
    });

    if (shifts.length === 0) {
      return NextResponse.json(
        { error: "No shifts found" },
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

    // Build shift data for emails
    const shiftsForEmail = shifts.map((shift) => {
      const currentVolunteers = shift._count.signups;
      const neededVolunteers = shift.capacity - currentVolunteers;
      return {
        shiftId: shift.id,
        shiftName: shift.shiftType.name,
        shiftDate: formatInNZT(new Date(shift.start), "EEEE, MMMM d, yyyy"),
        shiftDateISO: formatInNZT(new Date(shift.start), "yyyy-MM-dd"),
        shiftTime: `${formatInNZT(new Date(shift.start), "h:mm a")} - ${formatInNZT(new Date(shift.end), "h:mm a")}`,
        location: shift.location || "TBD",
        currentVolunteers,
        neededVolunteers,
      };
    });

    // Send one email per volunteer with all shifts
    const emailService = getEmailService();
    const allResults: Array<{ success: boolean; recipientId: string; email: string; error?: string }> = [];

    const emailPromises = volunteers.map(async (volunteer) => {
      const volunteerName = volunteer.firstName && volunteer.lastName
        ? `${volunteer.firstName} ${volunteer.lastName}`
        : volunteer.name || volunteer.email;

      try {
        await emailService.sendShiftShortageNotification({
          to: volunteer.email,
          volunteerName,
          shifts: shiftsForEmail,
        });

        return { success: true, recipientId: volunteer.id, email: volunteer.email };
      } catch (error) {
        console.error(`Failed to send email to ${volunteer.email}:`, error);
        return { success: false, recipientId: volunteer.id, email: volunteer.email, error: (error as Error).message };
      }
    });

    const results = await Promise.allSettled(emailPromises);
    results.forEach((r) => {
      if (r.status === "fulfilled") {
        allResults.push(r.value);
      } else {
        allResults.push({ success: false, recipientId: "", email: "unknown", error: "Promise rejected" });
      }
    });

    const successCount = allResults.filter((r) => r.success).length;

    // Log notification attempts to history (one entry per shift per recipient)
    const logEntries: Array<{
      sentBy: string;
      shiftId: string;
      shiftTypeName: string;
      shiftDate: Date;
      shiftLocation: string;
      recipientId: string;
      recipientEmail: string;
      recipientName: string;
      success: boolean;
      errorMessage: string | null;
    }> = [];

    for (const result of allResults) {
      const volunteer = volunteers.find((v) => v.email === result.email);
      const volunteerName = volunteer?.firstName && volunteer?.lastName
        ? `${volunteer.firstName} ${volunteer.lastName}`
        : volunteer?.name || result.email;

      for (const shift of shifts) {
        logEntries.push({
          sentBy: session.user.id,
          shiftId: shift.id,
          shiftTypeName: shift.shiftType.name,
          shiftDate: shift.start,
          shiftLocation: shift.location || "Unknown",
          recipientId: result.recipientId,
          recipientEmail: result.email,
          recipientName: volunteerName,
          success: result.success,
          errorMessage: result.error || null,
        });
      }
    }

    // Batch insert all log entries
    if (logEntries.length > 0) {
      await prisma.shortageNotificationLog.createMany({
        data: logEntries,
      });
    }

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      totalCount: volunteers.length,
      shiftsCount: shifts.length,
      volunteersCount: volunteers.length,
      results: allResults,
    });
  } catch (error) {
    console.error("Error sending shortage notifications:", error);
    return NextResponse.json(
      { error: "Failed to send notifications" },
      { status: 500 }
    );
  }
}

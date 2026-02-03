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

    // Send emails for each shift to each volunteer
    const emailService = getEmailService();
    const allResults: Array<{ success: boolean; email: string; shiftId?: string; error?: string }> = [];

    for (const shift of shifts) {
      const currentVolunteers = shift._count.signups;
      const neededVolunteers = shift.capacity - currentVolunteers;
      const shiftDate = formatInNZT(new Date(shift.start), "EEEE, MMMM d, yyyy");
      const shiftTime = `${formatInNZT(new Date(shift.start), "h:mm a")} - ${formatInNZT(new Date(shift.end), "h:mm a")}`;

      const emailPromises = volunteers.map(async (volunteer) => {
        // Build volunteer name for email
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

          return { success: true, email: volunteer.email, shiftId: shift.id };
        } catch (error) {
          console.error(`Failed to send email to ${volunteer.email} for shift ${shift.id}:`, error);
          return { success: false, email: volunteer.email, shiftId: shift.id, error: (error as Error).message };
        }
      });

      const results = await Promise.allSettled(emailPromises);
      results.forEach(r => {
        if (r.status === "fulfilled") {
          allResults.push(r.value);
        } else {
          allResults.push({ success: false, email: "unknown", error: "Promise rejected" });
        }
      });
    }

    const successCount = allResults.filter(r => r.success).length;
    const totalEmailsSent = shifts.length * volunteers.length;

    return NextResponse.json({
      success: true,
      sentCount: successCount,
      totalCount: totalEmailsSent,
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

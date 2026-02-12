import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { safeParseAvailability } from "@/lib/parse-availability";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeStats = searchParams.get("includeStats") === "true";
  const includeAdmins = searchParams.get("includeAdmins") === "true";

  try {
    const volunteers = await prisma.user.findMany({
      where: {
        role: includeAdmins ? { in: ["VOLUNTEER", "ADMIN"] } : "VOLUNTEER",
        signups: {
          some: {
            status: "CONFIRMED",
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        volunteerGrade: true,
        availableLocations: true,
        availableDays: true,
        receiveShortageNotifications: true,
        excludedShortageNotificationTypes: true,
        ...(includeStats && {
          _count: {
            select: {
              signups: {
                where: {
                  status: "CONFIRMED",
                },
              },
            },
          },
          signups: {
            where: {
              status: "CONFIRMED",
            },
            include: {
              shift: {
                select: {
                  end: true,
                },
              },
            },
          },
        }),
      },
      orderBy: {
        name: "asc",
      },
    });

    // Parse JSON fields safely and calculate completed shifts
    const now = new Date();
    const volunteersWithParsedFields = volunteers.map(volunteer => {
      // Calculate completed shifts if stats are included
      let completedShifts = 0;
      if (includeStats && 'signups' in volunteer && volunteer.signups) {
        completedShifts = (volunteer.signups as unknown as Array<{ shift: { end: Date } }>)
          .filter(signup => signup.shift.end < now).length;
      }

      // Remove signups from the response, only keep completedShifts count
      const { signups, ...volunteerWithoutSignups } = volunteer as any;

      return {
        ...volunteerWithoutSignups,
        availableDays: safeParseAvailability(volunteer.availableDays),
        availableLocations: safeParseAvailability(volunteer.availableLocations),
        ...(includeStats && { completedShifts }),
      };
    });

    return NextResponse.json(volunteersWithParsedFields);
  } catch (error) {
    console.error("Error fetching volunteers:", error);
    return NextResponse.json(
      { error: "Failed to fetch volunteers" },
      { status: 500 }
    );
  }
}
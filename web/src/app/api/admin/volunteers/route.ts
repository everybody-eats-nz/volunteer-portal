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

  try {
    const volunteers = await prisma.user.findMany({
      where: {
        role: "VOLUNTEER",
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
        }),
      },
      orderBy: {
        name: "asc",
      },
    });

    // Parse JSON fields safely (handles both JSON arrays and plain text from migration)
    const volunteersWithParsedFields = volunteers.map(volunteer => ({
      ...volunteer,
      availableDays: safeParseAvailability(volunteer.availableDays),
      availableLocations: safeParseAvailability(volunteer.availableLocations),
    }));

    return NextResponse.json(volunteersWithParsedFields);
  } catch (error) {
    console.error("Error fetching volunteers:", error);
    return NextResponse.json(
      { error: "Failed to fetch volunteers" },
      { status: 500 }
    );
  }
}
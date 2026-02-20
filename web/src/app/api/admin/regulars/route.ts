import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { LocationSchema } from "@/lib/validation-schemas";
import { formatInNZT, getStartOfDayUTC } from "@/lib/timezone";

// Validation schema for creating a regular volunteer
const createRegularVolunteerSchema = z.object({
  userId: z.string(),
  shiftTypeId: z.string(),
  location: LocationSchema,
  frequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]),
  availableDays: z.array(
    z.enum([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ])
  ),
  notes: z.string().optional(),
  addToExistingShifts: z.boolean().optional().default(false),
  autoApprove: z.boolean().optional().default(false),
});

// GET /api/admin/regulars - List all regular volunteers
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const location = searchParams.get("location");
    const shiftTypeId = searchParams.get("shiftTypeId");
    const isActive = searchParams.get("isActive");
    const includeInactive = searchParams.get("includeInactive") === "true";

    const where: Record<string, unknown> = {};

    if (location) {
      where.location = location;
    }

    if (shiftTypeId) {
      where.shiftTypeId = shiftTypeId;
    }

    if (!includeInactive) {
      where.isActive = true;
      where.isPausedByUser = false;
    } else if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    // Check for expired pauses and reactivate
    await prisma.regularVolunteer.updateMany({
      where: {
        isPausedByUser: true,
        pausedUntil: {
          lt: new Date(),
        },
      },
      data: {
        isPausedByUser: false,
        pausedUntil: null,
      },
    });

    const regulars = await prisma.regularVolunteer.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        shiftType: true,
        autoSignups: {
          take: 5,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            signup: {
              include: {
                shift: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(regulars);
  } catch (error) {
    console.error("Error fetching regular volunteers:", error);
    return NextResponse.json(
      { error: "Failed to fetch regular volunteers" },
      { status: 500 }
    );
  }
}

// POST /api/admin/regulars - Create a new regular volunteer
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    console.log("Creating regular volunteer with data:", body);
    const validated = createRegularVolunteerSchema.parse(body);

    // Check if user already has a regular volunteer record for this shift type
    const existing = await prisma.regularVolunteer.findUnique({
      where: {
        userId_shiftTypeId: {
          userId: validated.userId,
          shiftTypeId: validated.shiftTypeId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User is already a regular volunteer for this shift type" },
        { status: 400 }
      );
    }

    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: validated.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the shift type exists
    const shiftType = await prisma.shiftType.findUnique({
      where: { id: validated.shiftTypeId },
    });

    if (!shiftType) {
      return NextResponse.json(
        { error: "Shift type not found" },
        { status: 404 }
      );
    }

    // Create the regular volunteer record
    const regular = await prisma.regularVolunteer.create({
      data: {
        userId: validated.userId,
        shiftTypeId: validated.shiftTypeId,
        location: validated.location,
        frequency: validated.frequency,
        availableDays: validated.availableDays,
        notes: validated.notes,
        autoApprove: validated.autoApprove,
        createdBy: session?.user?.id,
        lastModifiedBy: session?.user?.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        shiftType: true,
      },
    });

    // TODO: Send notification to volunteer about being granted regular status

    let signupsCreated = 0;

    // If requested, add volunteer to existing future shifts
    if (validated.addToExistingShifts) {
      // Find all future shifts matching the criteria
      const now = new Date();
      const futureShifts = await prisma.shift.findMany({
        where: {
          shiftTypeId: validated.shiftTypeId,
          location: validated.location,
          start: {
            gt: now,
          },
        },
        orderBy: {
          start: "asc",
        },
      });

      // Filter shifts by day of week and frequency
      type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
      const matchingShifts = futureShifts.filter((shift) => {
        // Check if shift is on one of the available days (use NZ timezone)
        const dayOfWeek = formatInNZT(shift.start, "EEEE") as DayOfWeek;
        if (!validated.availableDays.includes(dayOfWeek)) {
          return false;
        }

        // Apply frequency filter
        if (validated.frequency === "WEEKLY") {
          return true;
        } else if (validated.frequency === "FORTNIGHTLY") {
          // Calculate weeks since regular was created (use now as creation time)
          const weeksSinceCreation = Math.floor(
            (shift.start.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)
          );
          return weeksSinceCreation % 2 === 0;
        } else if (validated.frequency === "MONTHLY") {
          // Check if this is the first occurrence of this day in the month
          const firstOccurrenceInMonth = new Date(
            shift.start.getFullYear(),
            shift.start.getMonth(),
            1
          );
          while (firstOccurrenceInMonth.getDay() !== shift.start.getDay()) {
            firstOccurrenceInMonth.setDate(
              firstOccurrenceInMonth.getDate() + 1
            );
          }
          return shift.start.getDate() === firstOccurrenceInMonth.getDate();
        }
        return false;
      });

      // Create signups for matching shifts
      const signups = [];
      const regularSignups = [];

      for (const shift of matchingShifts) {
        // Check if user already has a shift on this day (using NZ timezone boundaries)
        const startOfDayNZ = getStartOfDayUTC(shift.start);
        const endOfDayNZ = new Date(startOfDayNZ.getTime() + 24 * 60 * 60 * 1000);

        const existingSignup = await prisma.signup.findFirst({
          where: {
            userId: validated.userId,
            shift: {
              start: {
                gte: startOfDayNZ,
                lt: endOfDayNZ,
              },
            },
            status: {
              in: ["CONFIRMED", "REGULAR_PENDING", "PENDING"],
            },
          },
        });

        if (!existingSignup) {
          const signupId = crypto.randomUUID();
          signups.push({
            id: signupId,
            userId: validated.userId,
            shiftId: shift.id,
            status: (regular.autoApprove ? "CONFIRMED" : "REGULAR_PENDING") as "CONFIRMED" | "REGULAR_PENDING",
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          regularSignups.push({
            regularVolunteerId: regular.id,
            signupId: signupId,
          });
        }
      }

      if (signups.length > 0) {
        await prisma.signup.createMany({ data: signups });
        await prisma.regularSignup.createMany({ data: regularSignups });
        signupsCreated = signups.length;
      }
    }

    return NextResponse.json({ ...regular, signupsCreated }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error creating regular volunteer:", error);
    return NextResponse.json(
      { error: "Failed to create regular volunteer" },
      { status: 500 }
    );
  }
}

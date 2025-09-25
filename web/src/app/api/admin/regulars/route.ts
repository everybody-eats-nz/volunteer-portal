import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { LocationSchema } from "@/lib/validation-schemas";

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

    // Check if user already has a regular volunteer record
    const existing = await prisma.regularVolunteer.findUnique({
      where: {
        userId: validated.userId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "User is already a regular volunteer" },
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

    return NextResponse.json(regular, { status: 201 });
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

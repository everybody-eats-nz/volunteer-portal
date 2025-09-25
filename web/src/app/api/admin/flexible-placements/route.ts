import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

// GET /api/admin/flexible-placements - Get all flexible signups needing placement
export async function GET() {
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
    // Get flexible signups that haven't been placed yet
    const flexibleSignups = await prisma.signup.findMany({
      where: {
        isFlexiblePlacement: true,
        placedAt: null,
        status: {
          in: ["CONFIRMED", "PENDING"],
        },
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
            volunteerGrade: true,
            profilePhotoUrl: true,
          },
        },
        shift: {
          include: {
            shiftType: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(flexibleSignups);
  } catch (error) {
    console.error("Error fetching flexible signups:", error);
    return NextResponse.json(
      { error: "Failed to fetch flexible signups" },
      { status: 500 }
    );
  }
}

// POST /api/admin/flexible-placements - Place a flexible volunteer into a specific shift
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
      placementNotes: z.string().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { signupId, targetShiftId, placementNotes } = parsed.data;

    // Verify the signup exists and is flexible
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

    if (!signup.isFlexiblePlacement) {
      return NextResponse.json(
        { error: "This signup is not a flexible placement" },
        { status: 400 }
      );
    }

    if (signup.placedAt) {
      return NextResponse.json(
        { error: "This volunteer has already been placed" },
        { status: 400 }
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

    // Use transaction to handle the placement
    const result = await prisma.$transaction(async (tx) => {
      // Store original shift ID and mark as placed
      const originalShiftId = signup.shiftId;
      
      // Update the signup to point to the new shift and mark as placed
      const updatedSignup = await tx.signup.update({
        where: { id: signupId },
        data: {
          shiftId: targetShiftId,
          originalShiftId: originalShiftId,
          placedAt: new Date(),
          placementNotes: placementNotes || null,
          status: "CONFIRMED", // Confirm the placement
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

      // Create notification for the volunteer about their placement
      await tx.notification.create({
        data: {
          userId: signup.userId,
          type: "FLEXIBLE_PLACEMENT",
          title: "You've been placed!",
          message: `You've been placed in ${targetShift.shiftType.name} on ${targetShift.start.toLocaleDateString()} at ${targetShift.location}`,
          actionUrl: "/shifts/mine",
          relatedId: targetShiftId,
          isRead: false,
        },
      });

      return updatedSignup;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error placing flexible volunteer:", error);
    return NextResponse.json(
      { error: "Failed to place volunteer" },
      { status: 500 }
    );
  }
}
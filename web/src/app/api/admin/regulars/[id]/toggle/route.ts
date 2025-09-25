import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// PATCH /api/admin/regulars/[id]/toggle - Enable/disable regular status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;
    if (!session?.user || role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const { isActive } = await req.json();

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    // Check if regular volunteer exists
    const existing = await prisma.regularVolunteer.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Regular volunteer not found" },
        { status: 404 }
      );
    }

    // Update the active status
    const updated = await prisma.regularVolunteer.update({
      where: { id },
      data: {
        isActive,
        lastModifiedBy: session?.user?.id,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        shiftType: true,
      },
    });

    // If deactivating, cancel any pending regular signups
    if (!isActive) {
      const pendingSignups = await prisma.regularSignup.findMany({
        where: {
          regularVolunteerId: id,
          signup: {
            status: "REGULAR_PENDING",
          },
        },
        include: {
          signup: true,
        },
      });

      if (pendingSignups.length > 0) {
        const signupIds = pendingSignups.map((rs) => rs.signup.id);
        await prisma.signup.updateMany({
          where: {
            id: { in: signupIds },
          },
          data: {
            status: "CANCELED",
            canceledAt: new Date(),
            cancellationReason: "Regular volunteer status deactivated",
          },
        });
      }
    }

    return NextResponse.json({
      message: `Regular volunteer status ${
        isActive ? "enabled" : "disabled"
      } successfully`,
      regular: updated,
    });
  } catch (error) {
    console.error("Error toggling regular volunteer status:", error);
    return NextResponse.json(
      { error: "Failed to toggle regular volunteer status" },
      { status: 500 }
    );
  }
}

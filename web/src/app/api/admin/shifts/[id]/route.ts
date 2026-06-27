import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { deleteNotificationsForDeletedShifts } from "@/lib/notifications";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // First, check if the shift exists
    const existingShift = await prisma.shift.findUnique({
      where: { id },
      include: {
        signups: true,
      },
    });

    if (!existingShift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Delete in a transaction: signups → dangling notifications → shift.
    // Notifications have no FK/cascade to Shift, so their `/shifts/{id}` and
    // `/admin/shifts/{id}` deep links must be cleared here or they become dead
    // "Shift not found" links.
    await prisma.$transaction(async (tx) => {
      await tx.signup.deleteMany({
        where: { shiftId: id },
      });

      await deleteNotificationsForDeletedShifts([id], tx);

      await tx.shift.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shift:", error);
    return NextResponse.json(
      { error: "Failed to delete shift" },
      { status: 500 }
    );
  }
}
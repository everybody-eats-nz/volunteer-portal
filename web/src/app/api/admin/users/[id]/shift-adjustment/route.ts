import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateShiftAdjustmentSchema = z.object({
  adjustment: z.number().int(),
  note: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: userId } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { adjustment, note } = updateShiftAdjustmentSchema.parse(body);

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        completedShiftAdjustment: adjustment,
        completedShiftAdjustmentNote: note || null,
        completedShiftAdjustmentBy: session.user.email || session.user.name || "Unknown admin",
        completedShiftAdjustmentAt: new Date(),
      },
      select: {
        id: true,
        completedShiftAdjustment: true,
        completedShiftAdjustmentNote: true,
        completedShiftAdjustmentBy: true,
        completedShiftAdjustmentAt: true,
      },
    });

    return NextResponse.json({
      message: "Shift count adjustment updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating shift count adjustment:", error);

    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to update shift count adjustment" },
      { status: 500 }
    );
  }
}

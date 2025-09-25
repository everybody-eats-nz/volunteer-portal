import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateGradeSchema = z.object({
  volunteerGrade: z.enum(["GREEN", "YELLOW", "PINK"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: userId } = await params;

    // Check if user is authenticated and has admin role
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { volunteerGrade } = updateGradeSchema.parse(body);

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, volunteerGrade: true, name: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only allow grade changes for volunteers
    if (targetUser.role !== "VOLUNTEER") {
      return NextResponse.json(
        { error: "Can only change volunteer grades for users with VOLUNTEER role" },
        { status: 400 }
      );
    }

    // Check if the grade is actually changing
    if (targetUser.volunteerGrade === volunteerGrade) {
      return NextResponse.json(
        { error: "User already has this volunteer grade" },
        { status: 400 }
      );
    }

    // Update the volunteer grade
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { volunteerGrade },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        volunteerGrade: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: "Volunteer grade updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating volunteer grade:", error);

    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to update volunteer grade" },
      { status: 500 }
    );
  }
}
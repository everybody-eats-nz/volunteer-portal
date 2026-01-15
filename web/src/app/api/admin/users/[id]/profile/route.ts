import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

const updateProfileSchema = z.object({
  email: z.string().email("Please enter a valid email address").optional(),
  dateOfBirth: z.string().optional().refine(
    (val) => {
      if (!val) return true;
      const date = new Date(val);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      // Date must be at least 1 year in the past
      return !isNaN(date.getTime()) && date <= oneYearAgo;
    },
    { message: "Date of birth must be at least 1 year in the past" }
  ),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const { id: userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validatedData = updateProfileSchema.parse(body);

    // Check if the target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent changing own email/DOB through admin endpoint (use profile endpoint instead)
    if (currentUser.id === targetUser.id) {
      return NextResponse.json(
        { error: "Cannot update your own profile through admin endpoint" },
        { status: 400 }
      );
    }

    // If email is being changed, check if new email is already in use
    if (validatedData.email && validatedData.email !== targetUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: "Email address is already in use by another user" },
          { status: 400 }
        );
      }
    }

    // Build the update object with only provided fields
    const updateData: { email?: string; dateOfBirth?: Date } = {};

    if (validatedData.email) {
      updateData.email = validatedData.email;
    }

    if (validatedData.dateOfBirth) {
      updateData.dateOfBirth = new Date(validatedData.dateOfBirth);
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        dateOfBirth: true,
        name: true,
      },
    });

    return NextResponse.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

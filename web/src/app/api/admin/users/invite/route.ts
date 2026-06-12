import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { sendInvitationEmail } from "@/lib/email";
import bcrypt from "bcrypt";
import { z } from "zod";
import { randomBytes } from "crypto";

const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["VOLUNTEER", "ADMIN"]).default("VOLUNTEER"),
});

export async function POST(req: Request) {
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
    const body = await req.json();
    const validatedData = inviteUserSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Generate a temporary password using cryptographically secure random bytes
    const tempPassword = randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Create the user
    const newUser = await prisma.user.create({
      data: {
        email: validatedData.email,
        firstName: validatedData.firstName || null,
        lastName: validatedData.lastName || null,
        name:
          validatedData.firstName && validatedData.lastName
            ? `${validatedData.firstName} ${validatedData.lastName}`.trim()
            : validatedData.firstName || validatedData.lastName || null,
        hashedPassword,
        role: validatedData.role,
        volunteerAgreementAccepted: false,
        healthSafetyPolicyAccepted: false,
      },
    });

    // Send invitation email
    try {
      await sendInvitationEmail({
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: validatedData.role,
        tempPassword,
      });
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
      // Don't fail the entire request if email fails - the user was created successfully
    }

    return NextResponse.json({
      message: "User invited successfully",
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
      // TODO: Remove this in production - only for development
      tempPassword: tempPassword,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("User invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/email-verification";
import { getEmailService } from "@/lib/email-service";
import { getBaseUrl } from "@/lib/utils";

const markVerifiedSchema = z.object({
  note: z.string().max(500, "Note must be 500 characters or less").optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/users/[id]/email-verification
 * Resend the verification email to a volunteer on their behalf.
 *
 * Unlike the public /api/auth/resend-verification endpoint this is
 * admin-authenticated, so it skips bot protection and returns real errors
 * instead of anti-enumeration responses.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email is already verified" },
        { status: 400 }
      );
    }

    const token = await createVerificationToken(user.id);
    const emailService = getEmailService();
    await emailService.sendEmailVerification({
      to: user.email,
      firstName: user.firstName || user.name || "User",
      verificationLink: `${getBaseUrl()}/verify-email?token=${token}`,
    });

    return NextResponse.json({
      message: `Verification email sent to ${user.email}`,
    });
  } catch (error) {
    console.error("Admin resend verification error:", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id]/email-verification
 * Mark a volunteer's email as verified without them clicking the link.
 * Always records an AdminNote so the override is auditable.
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    // A missing/malformed body is treated as "no note", which is valid
    const body = await req.json().catch(() => ({}));
    const parsed = markVerifiedSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid body" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email is already verified" },
        { status: 400 }
      );
    }

    const note = parsed.data.note?.trim();
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationTokenExpiresAt: null,
        },
      }),
      prisma.adminNote.create({
        data: {
          volunteerId: id,
          content: `Marked email (${user.email}) as verified without the volunteer clicking the verification link.${note ? ` Reason: ${note}` : ""}`,
          createdBy: session.user.id,
        },
      }),
    ]);

    return NextResponse.json({ message: "Email marked as verified" });
  } catch (error) {
    console.error("Admin mark email verified error:", error);
    return NextResponse.json(
      { error: "Failed to mark email as verified" },
      { status: 500 }
    );
  }
}
